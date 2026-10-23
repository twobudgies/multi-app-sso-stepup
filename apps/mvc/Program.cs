using System.IdentityModel.Tokens.Jwt;
using Acme.IdpProfile;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;
var issuer = cfg["IDP_ISSUER"] ?? "http://localhost:8180/realms/stepup";
var port = cfg["MVC_PORT"] ?? "5200";
var apiUrl = $"http://localhost:{cfg["API_PORT"] ?? "5100"}";
builder.WebHost.UseUrls($"http://localhost:{port}");
var profile = Profile.FromEnvironment(cfg["IDP_PROFILE"]);
builder.Services.AddSingleton(profile);
builder.Services.AddSingleton(new AppConfig(apiUrl, cfg.GetValue("STEPUP_MAX_AGE_SECONDS", 60)));
builder.Services.AddHttpContextAccessor();
builder.Services.AddHttpClient<ApiClient>(c => c.BaseAddress = new Uri(apiUrl));
builder.Services.AddSingleton<ITicketStore, MemoryTicketStore>(); // tokens stay on the server, the cookie only carries a session key
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(o => { o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Lax; o.Cookie.Name = "bo.session"; o.IdleTimeout = TimeSpan.FromMinutes(20); });
builder.Services.AddControllersWithViews();

builder.Services.AddOptions<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme)
    .Configure<ITicketStore>((o, store) => o.SessionStore = store);
builder.Services.AddAuthentication(o =>
{
    o.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    o.DefaultChallengeScheme = OpenIdConnectDefaults.AuthenticationScheme;
})
.AddCookie(o =>
{
    o.Cookie.Name = "bo.auth";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Lax;
    // Dev exception: Keycloak and this app run on plain http://localhost, so Secure cannot be required.
    // In production this MUST be Always (https). See docs/architecture.md.
    o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    o.ExpireTimeSpan = TimeSpan.FromMinutes(30);
})
.AddOpenIdConnect(o =>
{
    o.Authority = issuer;
    o.ClientId = "app-mvc";
    o.ClientSecret = cfg["APP_MVC_CLIENT_SECRET"] ?? "change-me-dev-only";
    o.RequireHttpsMetadata = false; // dev only
    o.ResponseType = OpenIdConnectResponseType.Code; // Authorization Code
    o.UsePkce = true;
    o.SaveTokens = true;
    o.MapInboundClaims = false;
    o.GetClaimsFromUserInfoEndpoint = false;
    o.Scope.Clear(); o.Scope.Add("openid"); o.Scope.Add("profile"); o.Scope.Add("email");
    o.CallbackPath = "/signin-oidc";
    o.SignedOutCallbackPath = "/signout-callback-oidc";
    o.TokenValidationParameters = new TokenValidationParameters { NameClaimType = "preferred_username", ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true };
    // state and nonce are generated and verified by the handler.
    o.Events = new OpenIdConnectEvents
    {
        OnRedirectToIdentityProvider = ctx =>
        {
            if (ctx.Properties.Items.TryGetValue("stepup", out var v) && v == "1")
            {
                ctx.Properties.Items.TryGetValue("maxAge", out var mv);
                int? maxAge = int.TryParse(mv, out var m) ? m : null;
                foreach (var (k, val) in profile.BuildStepUpParameters(Level.LoA2, maxAge))
                {
                    if (k == "acr_values") ctx.ProtocolMessage.AcrValues = val;
                    else if (k == "max_age") ctx.ProtocolMessage.MaxAge = val;
                    else if (k == "prompt") ctx.ProtocolMessage.Prompt = val;
                }
            }
            return Task.CompletedTask;
        },
        OnRemoteFailure = ctx =>
        {
            // user cancelled MFA, or the IdP returned an error: go back with a clear message, action NOT performed
            ctx.Response.Redirect("/stepup/failed?e=" + Uri.EscapeDataString(ctx.Failure?.Message?.Contains("access_denied") == true ? "cancelled" : "error"));
            ctx.HandleResponse();
            return Task.CompletedTask;
        },
    };
});
builder.Services.AddAuthorization(o => o.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

var app = builder.Build();
var uiDir = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "../../packages/ui-tokens"));
app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(uiDir), RequestPath = "/ui" });
app.UseStaticFiles();
app.UseRouting();
app.UseSession();
app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/health", () => "ok").AllowAnonymous();
app.MapControllerRoute("default", "{controller=BackOffice}/{action=Index}/{id?}");
app.Run();

public record AppConfig(string ApiUrl, int WindowSeconds);

public class MemoryTicketStore : ITicketStore
{
    readonly Dictionary<string, AuthenticationTicket> _t = new();
    readonly object _l = new();
    public Task<string> StoreAsync(AuthenticationTicket ticket) { var k = Guid.NewGuid().ToString("N"); lock (_l) _t[k] = ticket; return Task.FromResult(k); }
    public Task RenewAsync(string key, AuthenticationTicket ticket) { lock (_l) _t[key] = ticket; return Task.CompletedTask; }
    public Task<AuthenticationTicket?> RetrieveAsync(string key) { lock (_l) return Task.FromResult(_t.GetValueOrDefault(key)); }
    public Task RemoveAsync(string key) { lock (_l) _t.Remove(key); return Task.CompletedTask; }
}
