using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

public record Pending(string Action, string Arg, string Title, string ReturnTo, string Reason);

public class BaseController(Treasury t, SamlSettings s) : Controller
{
    protected readonly Treasury T = t;
    protected readonly SamlSettings S = s;
    public override void OnActionExecuting(ActionExecutingContext c)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            ViewBag.Level = User.FindFirstValue("acme_level") ?? "LoA1";
            ViewBag.AuthTime = User.FindFirstValue("acme_auth_instant") ?? "";
            ViewBag.Window = S.WindowSeconds;
            ViewBag.ServerTime = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        }
        base.OnActionExecuting(c);
    }

    protected IActionResult Act(string action, string arg, string returnTo)
    {
        var (ok, reason) = T.CheckStepUp(User, DateTimeOffset.UtcNow);
        if (!ok)
        {
            // Not strong or fresh enough: do NOT perform it. Park it in the server session and ask for step-up.
            HttpContext.Session.SetString("pending", JsonSerializer.Serialize(new Pending(action, arg, Treasury.Title(action, arg), returnTo, reason)));
            return Redirect("/stepup");
        }
        TempData["ok"] = T.Perform(action, arg);
        return LocalRedirect(returnTo);
    }
}

public class TreasuryController(Treasury t, SamlSettings s) : BaseController(t, s)
{
    public IActionResult Index() => View(T);
    public IActionResult Payments() => View(T);
    [HttpPost, ValidateAntiForgeryToken]
    public IActionResult Release(string id) => Act("release-payment", id, "/Treasury/Payments");
    public IActionResult Approvers() => View(T);
    [HttpPost, ValidateAntiForgeryToken]
    public IActionResult AddApprover(string name) => Act("add-approver", name ?? "", "/Treasury/Approvers");

    /// <summary>Learning page: shows what the IdP actually put in the assertion (no secrets in it).</summary>
    public IActionResult Assertion() => View();
    [Microsoft.AspNetCore.Authorization.AllowAnonymous, Route("/signedout")]
    public IActionResult SignedOut() => View();
}

[Route("stepup")]
public class StepUpController(Treasury t, SamlSettings s) : BaseController(t, s)
{
    Pending? GetPending() { var j = HttpContext.Session.GetString("pending"); return j == null ? null : JsonSerializer.Deserialize<Pending>(j); }

    [HttpGet("")]
    public IActionResult Index() { var p = GetPending(); return p == null ? Redirect("/") : View(p); }

    [HttpPost("go"), ValidateAntiForgeryToken]
    public IActionResult Go() => GetPending() == null ? Redirect("/") : Redirect("/saml/login?stepUp=true&returnUrl=" + Uri.EscapeDataString("/stepup/complete"));

    [HttpGet("complete")]
    public IActionResult Complete()
    {
        var p = GetPending();
        HttpContext.Session.Remove("pending"); // consume once: no loops, no replays
        if (p == null) return Redirect("/");
        var returnTo = Url.IsLocalUrl(p.ReturnTo) ? p.ReturnTo : "/";
        // Re-check with the NEW assertion's facts before doing anything.
        var (ok, _) = T.CheckStepUp(User, DateTimeOffset.UtcNow);
        TempData[ok ? "ok" : "err"] = ok ? $"{p.Title}: {T.Perform(p.Action, p.Arg)}" : "Verification was not strong enough, so the action was NOT performed.";
        return LocalRedirect(returnTo);
    }

    [HttpGet("failed"), Microsoft.AspNetCore.Authorization.AllowAnonymous]
    public IActionResult Failed(string? e)
    {
        HttpContext.Session.Remove("pending");
        ViewBag.Message = e == "cancelled" ? "Step-up was cancelled. Nothing was changed." : "Sign-in failed. Nothing was changed.";
        return View("Failed");
    }

    [HttpPost("cancel"), ValidateAntiForgeryToken]
    public IActionResult Cancel()
    {
        var p = GetPending(); HttpContext.Session.Remove("pending");
        TempData["err"] = "Cancelled. Nothing was changed.";
        return LocalRedirect(p != null && Url.IsLocalUrl(p.ReturnTo) ? p.ReturnTo : "/");
    }
}
