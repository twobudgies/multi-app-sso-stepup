using System.Security.Cryptography.X509Certificates;
using ITfoxtec.Identity.Saml2;
using ITfoxtec.Identity.Saml2.Schemas.Metadata;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;
var issuer = cfg["IDP_ISSUER"] ?? "http://localhost:8180/realms/stepup";
var port = cfg["SAML_PORT"] ?? "5500";
builder.WebHost.UseUrls($"http://localhost:{port}");

// ---- SAML settings: the only IdP-specific values live here, in config ----
var entityId = cfg["SAML_ENTITY_ID"] ?? "urn:acme:treasury";            // who WE are (SP entityID, must match the IdP's client)
var classRefLoa2 = cfg["SAML_LOA2_CLASSREF"] ?? "urn:acme:loa:2";       // AuthnContextClassRef that means "password + TOTP"
var classRefLoa1 = cfg["SAML_LOA1_CLASSREF"] ?? "urn:acme:loa:1";
var window = cfg.GetValue("STEPUP_MAX_AGE_SECONDS", 60);
var skew = cfg.GetValue("STEPUP_CLOCK_SKEW_SECONDS", 5);
// Keycloak (26.0) ignores the SAML RequestedAuthnContext, so step-up uses a second SP entityID that the IdP binds to "LoA2 required".
var stepUpEntityId = cfg["SAML_STEPUP_ENTITY_ID"] ?? entityId + ":stepup";
builder.Services.AddSingleton(new SamlSettings(entityId, stepUpEntityId, classRefLoa1, classRefLoa2, window, skew));

builder.Services.AddSingleton(sp =>
{
    // Trust anchor: the IdP's signing certificate, read from its metadata. Every assertion must be signed by it.
    var metadataUrl = cfg["SAML_IDP_METADATA_URL"] ?? $"{issuer}/protocol/saml/descriptor";
    var xml = FetchWithRetry(metadataUrl);
    var idp = new EntityDescriptor();
    idp.ReadIdPSsoDescriptor(xml);
    if (idp.IdPSsoDescriptor == null) throw new InvalidOperationException("IdP metadata has no IDPSSODescriptor");
    Saml2Configuration Make(string issuerId) {
    var c = new Saml2Configuration
    {
        Issuer = issuerId,
        SingleSignOnDestination = idp.IdPSsoDescriptor.SingleSignOnServices.First().Location,
        SingleLogoutDestination = idp.IdPSsoDescriptor.SingleLogoutServices.First().Location,
        CertificateValidationMode = System.ServiceModel.Security.X509CertificateValidationMode.None, // the cert is pinned from metadata, not chain-validated (self-signed in dev)
        RevocationMode = X509RevocationMode.NoCheck,
    };
    c.AllowedAudienceUris.Add(entityId);                 // assertion must be addressed to us (either of our two entityIDs)
    c.AllowedAudienceUris.Add(stepUpEntityId);
    c.SignatureValidationCertificates.AddRange(idp.IdPSsoDescriptor.SigningCertificates);
    if (c.SignatureValidationCertificates.Count == 0) throw new InvalidOperationException("IdP metadata has no signing certificate");
    return c; }
    return new SamlConfigs(Make(entityId), Make(stepUpEntityId));
});

builder.Services.AddSingleton<ITicketStore, MemoryTicketStore>(); // claims stay on the server, the cookie only carries a key
builder.Services.AddOptions<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme)
    .Configure<ITicketStore>((o, store) => o.SessionStore = store);
builder.Services.AddSingleton<Treasury>();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(o => { o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Lax; o.Cookie.Name = "tr.session"; o.IdleTimeout = TimeSpan.FromMinutes(20); });
builder.Services.AddControllersWithViews();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
.AddCookie(o =>
{
    o.Cookie.Name = "tr.auth";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Lax;
    // Dev exception, same as apps/mvc: plain http://localhost. In production this MUST be Always (https).
    o.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    o.ExpireTimeSpan = TimeSpan.FromMinutes(30);
    o.LoginPath = "/saml/login";
    o.ReturnUrlParameter = "returnUrl";
});
builder.Services.AddAuthorization(o => o.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

var app = builder.Build();
_ = app.Services.GetRequiredService<SamlConfigs>(); // fail fast at startup if the IdP metadata is unreachable or has no signing cert
var uiDir = Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "../../packages/ui-tokens"));
app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(uiDir), RequestPath = "/ui" });
app.UseStaticFiles();
app.UseRouting();
app.UseSession();
app.UseAuthentication();
app.UseAuthorization();
app.MapGet("/health", () => "ok").AllowAnonymous();
app.MapControllerRoute("default", "{controller=Treasury}/{action=Index}/{id?}");
app.Run();

static string FetchWithRetry(string url)
{
    using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
    for (var i = 1; ; i++)
    {
        try { return http.GetStringAsync(url).GetAwaiter().GetResult(); }
        catch when (i < 10) { Thread.Sleep(2000); }
    }
}

public record SamlConfigs(Saml2Configuration Normal, Saml2Configuration StepUp);
public record SamlSettings(string EntityId, string StepUpEntityId, string ClassRefLoa1, string ClassRefLoa2, int WindowSeconds, int SkewSeconds);

public class MemoryTicketStore : ITicketStore
{
    readonly Dictionary<string, AuthenticationTicket> _t = new();
    readonly object _l = new();
    public Task<string> StoreAsync(AuthenticationTicket ticket) { var k = Guid.NewGuid().ToString("N"); lock (_l) _t[k] = ticket; return Task.FromResult(k); }
    public Task RenewAsync(string key, AuthenticationTicket ticket) { lock (_l) _t[key] = ticket; return Task.CompletedTask; }
    public Task<AuthenticationTicket?> RetrieveAsync(string key) { lock (_l) return Task.FromResult(_t.GetValueOrDefault(key)); }
    public Task RemoveAsync(string key) { lock (_l) _t.Remove(key); return Task.CompletedTask; }
}
