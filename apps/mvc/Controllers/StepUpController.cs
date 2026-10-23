using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;
using Acme.IdpProfile;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;

[Route("stepup")]
public class StepUpController(ApiClient api, AppConfig cfg, Profile profile) : BaseController(api, cfg)
{
    Pending? GetPending() { var s = HttpContext.Session.GetString("pending"); return s == null ? null : JsonSerializer.Deserialize<Pending>(s); }

    [HttpGet("")]
    public IActionResult Index()
    {
        var p = GetPending();
        if (p == null) return Redirect("/");
        return View(p);
    }

    [HttpPost("go"), ValidateAntiForgeryToken]
    public IActionResult Go()
    {
        var p = GetPending();
        if (p == null) return Redirect("/");
        var props = new AuthenticationProperties { RedirectUri = "/stepup/complete" };
        props.Items["stepup"] = "1";
        props.Items["maxAge"] = (p.MaxAge ?? cfg.WindowSeconds).ToString();
        return Challenge(props, "OpenIdConnect");
    }

    [HttpGet("complete")]
    public async Task<IActionResult> Complete()
    {
        var p = GetPending();
        HttpContext.Session.Remove("pending"); // consume once: no loops, no replays
        if (p == null) return Redirect("/");
        var returnTo = Url.IsLocalUrl(p.ReturnTo) ? p.ReturnTo : "/"; // allow-list: local paths only
        // Do not assume the IdP honored the request: check the level in the new ID token, and the API re-checks anyway.
        var idToken = await HttpContext.GetTokenAsync("id_token");
        var claims = new JwtSecurityTokenHandler().ReadJwtToken(idToken).Claims.Select(c => (c.Type, c.Value));
        if (profile.ReadLevel(claims) != Level.LoA2)
        {
            TempData["err"] = "The identity provider did not raise the login level, so the action was NOT performed.";
            return LocalRedirect(returnTo);
        }
        var body = JsonSerializer.Deserialize<JsonElement>(p.BodyJson);
        var r = await Api.Post($"/sensitive/{p.Action}", body);
        TempData[r.Status is >= 200 and < 300 ? "ok" : "err"] = r.Status is >= 200 and < 300 ? $"{p.Title}: done." : (r.IsStepUp ? "Verification was not strong enough, so the action was NOT performed." : r.Message ?? "Request failed");
        return LocalRedirect(returnTo);
    }

    [HttpGet("failed")]
    [Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public IActionResult Failed(string e)
    {
        TempData["err"] = e == "cancelled" ? "Step-up was cancelled. Nothing was changed." : "Sign-in failed. Nothing was changed.";
        HttpContext.Session.Remove("pending");
        return Redirect("/");
    }

    [HttpPost("cancel"), ValidateAntiForgeryToken]
    public IActionResult Cancel()
    {
        var p = GetPending(); HttpContext.Session.Remove("pending");
        TempData["err"] = "Cancelled. Nothing was changed.";
        return LocalRedirect(p != null && Url.IsLocalUrl(p.ReturnTo) ? p.ReturnTo : "/");
    }
}
