using System.Security.Claims;
using ITfoxtec.Identity.Saml2;
using ITfoxtec.Identity.Saml2.MvcCore;
using ITfoxtec.Identity.Saml2.Schemas;
using ITfoxtec.Identity.Saml2.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

/// <summary>The SAML "service provider" endpoints: login (AuthnRequest), ACS (assertion consumer), logout.</summary>
[AllowAnonymous, Route("saml")]
public class SamlController(SamlConfigs cfgs, SamlSettings s) : Controller
{
    Saml2Configuration saml => cfgs.Normal;
    const string ReqKey = "saml.req";
    record PendingRequest(string Id, string Relay, string ReturnUrl, bool StepUp);

    /// <summary>Step 1: send the browser to the IdP with an AuthnRequest. For step-up we also ask for LoA2 and force a fresh login.</summary>
    [HttpGet("login")]
    public IActionResult Login(string? returnUrl, bool stepUp = false)
    {
        returnUrl = Url.IsLocalUrl(returnUrl) ? returnUrl! : "/"; // allow-list: local paths only
        var req = new Saml2AuthnRequest(stepUp ? cfgs.StepUp : cfgs.Normal);
        if (stepUp)
        {
            req.ForceAuthn = true; // "do not reuse the IdP session": the user must prove themselves again, now
            req.RequestedAuthnContext = new RequestedAuthnContext
            {
                Comparison = AuthnContextComparisonTypes.Minimum,
                AuthnContextClassRef = new[] { s.ClassRefLoa2 },
            };
        }
        var relay = Guid.NewGuid().ToString("N");
        HttpContext.Session.SetString(ReqKey, System.Text.Json.JsonSerializer.Serialize(new PendingRequest(req.IdAsString, relay, returnUrl, stepUp)));
        var binding = new Saml2RedirectBinding();
        binding.SetRelayStateQuery(new Dictionary<string, string> { ["r"] = relay });
        return binding.Bind(req).ToActionResult();
    }

    /// <summary>Step 2: the IdP posts the signed assertion here. We verify everything before trusting it.</summary>
    [HttpPost("acs")]
    public async Task<IActionResult> AssertionConsumerService()
    {
        var pendingJson = HttpContext.Session.GetString(ReqKey);
        HttpContext.Session.Remove(ReqKey); // one request, one response: no replays
        var binding = new Saml2PostBinding();
        var resp = new Saml2AuthnResponse(saml);
        try
        {
            binding.ReadSamlResponse(Request.ToGenericHttpRequest(), resp);
            if (resp.Status != Saml2StatusCodes.Success) return Failed(resp.Status == Saml2StatusCodes.AuthnFailed || resp.Status == Saml2StatusCodes.RequestDenied ? "cancelled" : "error");
            if (pendingJson == null) return Failed("error");     // we never asked for this response (IdP-initiated or replay)
            var pending = System.Text.Json.JsonSerializer.Deserialize<PendingRequest>(pendingJson)!;
            binding.Unbind(Request.ToGenericHttpRequest(), resp); // checks signature, audience, NotBefore / NotOnOrAfter, issuer
            if (resp.InResponseTo?.Value != pending.Id) return Failed("error"); // must answer OUR request
            var relay = binding.GetRelayStateQuery();
            if (!relay.TryGetValue("r", out var r) || r != pending.Relay) return Failed("error");

            // The facts a step-up decision needs live in the assertion's AuthnStatement.
            var stmt = resp.Saml2SecurityToken.Assertion.Statements.OfType<Microsoft.IdentityModel.Tokens.Saml2.Saml2AuthenticationStatement>().FirstOrDefault();
            if (stmt == null) return Failed("error");
            var classRef = stmt.AuthenticationContext?.ClassReference?.OriginalString ?? "";
            var instant = new DateTimeOffset(stmt.AuthenticationInstant).ToUnixTimeSeconds();
            var loaAttr = resp.ClaimsIdentity.FindFirst("loa")?.Value;   // set by the IdP only on the step-up entity, inside the signed assertion
            var level = (classRef == s.ClassRefLoa2 || loaAttr == "2") ? "LoA2" : "LoA1"; // anything unknown counts as the weaker level
            // If we asked for step-up, do not assume the IdP did it: the new assertion must prove it.
            if (pending.StepUp && level != "LoA2") { TempData["err"] = "The identity provider did not raise the login level, so the action was NOT performed."; return LocalRedirect(pending.ReturnUrl); }

            var claims = new List<Claim>(resp.ClaimsIdentity.Claims)
            {
                new("acme_level", level), new("acme_authn_context", classRef), new("acme_auth_instant", instant.ToString()),
            };
            var identity = new ClaimsIdentity(claims, "saml2", "username", ClaimTypes.Role);
            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(identity));
            return LocalRedirect(pending.ReturnUrl);
        }
        catch (Exception ex)
        {
            // bad signature, wrong audience, expired, tampered: nobody is signed in
            HttpContext.RequestServices.GetRequiredService<ILogger<SamlController>>().LogWarning("SAML response rejected: {Message}", ex.Message);
            return Failed("error");
        }
    }

    IActionResult Failed(string e) => Redirect("/stepup/failed?e=" + e);

    /// <summary>SP-initiated logout: tell the IdP to end the session (and the IdP tells the other apps that support it).</summary>
    [HttpPost("logout"), Authorize, ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        var nameId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var sessionIndex = User.FindFirstValue(Saml2ClaimTypes.SessionIndex);
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        if (nameId == null) return Redirect("/signedout");
        var req = new Saml2LogoutRequest(saml) { NameId = new Microsoft.IdentityModel.Tokens.Saml2.Saml2NameIdentifier(nameId), SessionIndex = sessionIndex };
        return new Saml2RedirectBinding().Bind(req).ToActionResult();
    }

    /// <summary>The IdP answers our logout (LogoutResponse) or asks us to log out because another app signed out (LogoutRequest).</summary>
    [Route("slo"), AcceptVerbs("GET", "POST")]
    public async Task<IActionResult> SingleLogout()
    {
        var generic = Request.ToGenericHttpRequest(validate: false);
        try
        {
            if (Request.Query.ContainsKey("SAMLRequest") || Request.Form.ContainsKey("SAMLRequest"))
            {
                var lr = new Saml2LogoutRequest(saml);
                if (Request.Method == "POST") new Saml2PostBinding().ReadSamlRequest(generic, lr); else new Saml2RedirectBinding().ReadSamlRequest(generic, lr);
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                var resp = new Saml2LogoutResponse(saml) { InResponseToAsString = lr.IdAsString, Status = Saml2StatusCodes.Success };
                return new Saml2RedirectBinding().Bind(resp).ToActionResult();
            }
            var lo = new Saml2LogoutResponse(saml);
            if (Request.Method == "POST") new Saml2PostBinding().ReadSamlResponse(generic, lo); else new Saml2RedirectBinding().ReadSamlResponse(generic, lo);
        }
        catch { /* even if the response cannot be verified, our local session is already gone */ }
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Redirect("/signedout");
    }
}
