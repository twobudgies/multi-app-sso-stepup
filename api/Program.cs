using System.Security.Claims;
using System.Text.Json;
using Acme.IdpProfile;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

// ---- Config (env vars; see .env.example) ----
var issuer = cfg["IDP_ISSUER"] ?? "http://localhost:8180/realms/stepup";
var audience = cfg["API_AUDIENCE"] ?? "stepup-api";
var defaultMaxAge = int.TryParse(cfg["STEPUP_MAX_AGE_SECONDS"], out var m) ? m : 60;
var skew = int.TryParse(cfg["STEPUP_CLOCK_SKEW_SECONDS"], out var s) ? s : 5;
var port = cfg["API_PORT"] ?? "5100";
builder.WebHost.UseUrls($"http://localhost:{port}");

// ---- IdP profile + policy: fail fast ----
var profile = Profile.FromEnvironment(cfg["IDP_PROFILE"]);
var policy = JsonSerializer.Deserialize<PolicyFile>(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "policy.json")),
    new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;
foreach (var a in policy.Actions.Values) a.ResolvedMaxAge = a.MaxAgeSeconds == "default" ? defaultMaxAge : (a.MaxAgeSeconds is null ? null : int.Parse(a.MaxAgeSeconds));
profile.EnsureCanEnforce(policy.Actions.Values.Any(a => a.ResolvedMaxAge != null));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(o =>
{
    o.MetadataAddress = issuer.TrimEnd('/') + "/.well-known/openid-configuration"; // JWKS fetched, cached and refreshed on unknown kid
    o.RequireHttpsMetadata = false; // dev only: Keycloak runs on http://localhost
    o.MapInboundClaims = false;     // keep claim names exactly as in the token
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = issuer, ValidAudience = audience,
        ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true,
        RequireSignedTokens = true, RequireExpirationTime = true, ClockSkew = TimeSpan.FromSeconds(skew),
        ValidAlgorithms = new[] { "RS256" }
    };
});
builder.Services.AddAuthorization();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins("http://localhost:5300", "http://localhost:5400", "http://localhost:5200")
    .AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("WWW-Authenticate")));

var app = builder.Build();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// ---- Fake in-memory bank data ----
var state = new BankState();

static IEnumerable<(string, string)> ClaimPairs(ClaimsPrincipal u) => u.Claims.Select(c => (c.Type, c.Value));

app.MapGet("/health", () => Results.Ok(new { status = "ok", profile = profile.Name }));

app.MapGet("/me", (ClaimsPrincipal u) =>
{
    var cl = ClaimPairs(u).ToList();
    return Results.Ok(new
    {
        user = u.FindFirst("preferred_username")?.Value ?? u.FindFirst("sub")?.Value,
        name = u.FindFirst("given_name")?.Value,
        email = state.Email,
        level = profile.ReadLevel(cl)?.ToString() ?? "unknown",
        authTime = profile.ReadAuthTime(cl),
        exp = long.Parse(u.FindFirst("exp")!.Value),
        stepUpWindowSeconds = defaultMaxAge,
        serverTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
    });
}).RequireAuthorization();

app.MapGet("/policy", () => Results.Ok(policy.Actions.Select(kv => new { action = kv.Key, kv.Value.App, kv.Value.Title, kv.Value.Level, maxAgeSeconds = kv.Value.ResolvedMaxAge, kv.Value.OnlyAboveAmount })))
   .RequireAuthorization();
app.MapGet("/accounts", () => Results.Ok(state.Accounts)).RequireAuthorization();
app.MapGet("/payees", () => Results.Ok(state.Payees)).RequireAuthorization();
app.MapGet("/limits", () => Results.Ok(new { dailyTransferLimit = state.Limit })).RequireAuthorization();
app.MapGet("/transfers", () => Results.Ok(state.Transfers)).RequireAuthorization();

app.MapPost("/sensitive/{action}", (string action, ClaimsPrincipal u, HttpContext ctx, ActionRequest body) =>
{
    if (!policy.Actions.TryGetValue(action, out var rule)) return Results.NotFound(new { error = "unknown_action" });
    var required = Enum.Parse<Level>(rule.Level);
    var needsCheck = rule.OnlyAboveAmount is null || (body.Amount ?? 0) > rule.OnlyAboveAmount;
    if (needsCheck)
    {
        var d = profile.Evaluate(ClaimPairs(u), required, rule.ResolvedMaxAge, DateTimeOffset.UtcNow, skew);
        if (!d.Allowed)
        {
            ctx.Response.Headers.WWWAuthenticate = profile.BuildChallenge(required, rule.ResolvedMaxAge);
            return Results.Json(new { error = "insufficient_user_authentication", code = d.Code, message = d.Message, action, requiredLevel = rule.Level, maxAgeSeconds = rule.ResolvedMaxAge }, statusCode: 401);
        }
    }
    // ---- Action is allowed: perform it (fake data) ----
    string? err;
    object? result = state.Apply(action, body, out err);
    if (err != null) return Results.BadRequest(new { error = "bad_request", message = err });
    return Results.Ok(new { ok = true, action, stepUpApplied = needsCheck, result });
}).RequireAuthorization();

app.Run();

record ActionRequest(string? Email, string? PayeeName, string? Iban, decimal? Amount, string? To, decimal? Limit, string? TransferId);
class PolicyFile { public Dictionary<string, ActionRule> Actions { get; set; } = new(); }
class ActionRule
{
    public string App { get; set; } = ""; public string Title { get; set; } = ""; public string Level { get; set; } = "LoA2";
    public string? MaxAgeSeconds { get; set; } public decimal? OnlyAboveAmount { get; set; }
    public int? ResolvedMaxAge { get; set; }
}

class BankState
{
    public string Email = "alice@example.test";
    public decimal Limit = 5000;
    public object[] Accounts => new object[] {
        new { id = "CHK-001", name = "Everyday Account", balance = 4210.55m, currency = "EUR" },
        new { id = "SAV-002", name = "Savings", balance = 18950.00m, currency = "EUR" } };
    public List<object> Payees = new() { new { name = "City Utilities", iban = "XX00 0000 0000 0001" }, new { name = "Landlord Ltd", iban = "XX00 0000 0000 0002" } };
    public List<TransferRec> Transfers = new() {
        new("T-1001", "Landlord Ltd", 1200m, "pending"), new("T-1002", "Gadget Store", 2400m, "pending") };
    int next = 1003;
    public object? Apply(string action, ActionRequest b, out string? err)
    {
        err = null;
        switch (action)
        {
            case "change-email":
                if (string.IsNullOrWhiteSpace(b.Email) || !b.Email.Contains('@')) { err = "A valid e-mail is required"; return null; }
                Email = b.Email.Trim(); return new { email = Email };
            case "add-payee":
                if (string.IsNullOrWhiteSpace(b.PayeeName)) { err = "Payee name required"; return null; }
                Payees.Add(new { name = b.PayeeName.Trim(), iban = b.Iban ?? "XX00 0000 0000 9999" }); return new { payees = Payees.Count };
            case "transfer":
                if (b.Amount is null or <= 0) { err = "Amount must be positive"; return null; }
                var id = "T-" + next++; Transfers.Insert(0, new(id, b.To ?? "Unknown", b.Amount.Value, "sent")); return new { id };
            case "change-limit":
                if (b.Limit is null or <= 0) { err = "Limit must be positive"; return null; }
                Limit = b.Limit.Value; return new { dailyTransferLimit = Limit };
            case "approve-transfer":
                var t = Transfers.FirstOrDefault(x => x.Id == b.TransferId && x.Status == "pending");
                if (t is null) { err = "No such pending transfer"; return null; }
                Transfers[Transfers.IndexOf(t)] = t with { Status = "approved" }; return new { id = t.Id, status = "approved" };
        }
        err = "Unknown action"; return null;
    }
}
record TransferRec(string Id, string To, decimal Amount, string Status);
