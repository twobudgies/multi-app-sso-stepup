using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

public class BaseController(ApiClient api, AppConfig cfg) : Controller
{
    protected readonly ApiClient Api = api;
    public override async Task OnActionExecutionAsync(ActionExecutingContext c, ActionExecutionDelegate next)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            var me = await Api.Get("/me");
            if (me.Status == 401 && !me.IsStepUp) { await HttpContext.SignOutAsync(); c.Result = Redirect("/"); return; } // token expired: sign in again (SSO, no prompt)
            ViewBag.Me = me.Body;
            ViewBag.Window = cfg.WindowSeconds;
        }
        await next();
    }

    /// <summary>Calls a sensitive action. On a step-up challenge the pending action is kept in the server session.</summary>
    protected async Task<IActionResult> Act(string action, object body, string title, string returnTo, string okText)
    {
        var r = await Api.Post($"/sensitive/{action}", body);
        if (r.IsStepUp)
        {
            HttpContext.Session.SetString("pending", JsonSerializer.Serialize(new Pending(action, JsonSerializer.Serialize(body), title, returnTo, r.Message ?? "", r.MaxAge)));
            return Redirect("/stepup");
        }
        TempData[r.Status is >= 200 and < 300 ? "ok" : "err"] = r.Status is >= 200 and < 300 ? okText : (r.Message ?? $"Request failed ({r.Status})");
        return LocalRedirect(returnTo);
    }
}
public record Pending(string Action, string BodyJson, string Title, string ReturnTo, string Reason, int? MaxAge);

public class BackOfficeController(ApiClient api, AppConfig cfg) : BaseController(api, cfg)
{
    public async Task<IActionResult> Index()
    {
        ViewBag.Limits = (await Api.Get("/limits")).Body;
        ViewBag.Transfers = (await Api.Get("/transfers")).Body;
        return View();
    }
    public async Task<IActionResult> Limits() { ViewBag.Limits = (await Api.Get("/limits")).Body; return View(); }
    [HttpPost, ValidateAntiForgeryToken]
    public Task<IActionResult> Limits(decimal limit) => Act("change-limit", new { limit }, "Change transfer limit", "/BackOffice/Limits", "Daily transfer limit updated.");
    public async Task<IActionResult> Approvals() { ViewBag.Transfers = (await Api.Get("/transfers")).Body; return View(); }
    [HttpPost, ValidateAntiForgeryToken]
    public Task<IActionResult> Approve(string id) => Act("approve-transfer", new { transferId = id }, $"Approve transfer {id}", "/BackOffice/Approvals", $"Transfer {id} approved.");
    public IActionResult Users() => View();
    [HttpPost, ValidateAntiForgeryToken]
    public async Task<IActionResult> SignOut()
    {
        await HttpContext.SignOutAsync("Cookies");
        return SignOut(new AuthenticationProperties { RedirectUri = "/signedout" }, "OpenIdConnect");
    }
    [Microsoft.AspNetCore.Authorization.AllowAnonymous, Route("/signedout")]
    public IActionResult SignedOut() => View();
}
