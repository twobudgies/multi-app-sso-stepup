using System.Security.Claims;

/// <summary>Demo data and the step-up decision. SAML has no access token and no shared API here, so THIS server is the policy point.</summary>
public class Treasury(SamlSettings s)
{
    public record Payment(string Id, string To, decimal Amount, string Status);
    readonly object _l = new();
    readonly List<Payment> _payments = new()
    {
        new("P-3001", "Northwind Supplies", 4200m, "held"),
        new("P-3002", "Contoso Logistics", 18500m, "held"),
        new("P-3003", "Fabrikam Rent", 2750m, "held"),
    };
    readonly List<string> _approvers = new() { "alice" };
    public IReadOnlyList<Payment> Payments() { lock (_l) return _payments.ToList(); }
    public IReadOnlyList<string> Approvers() { lock (_l) return _approvers.ToList(); }

    /// <summary>Allowed only if the assertion says LoA2 AND the login happened inside the window. Reads server-side claims, never browser input.</summary>
    public (bool Ok, string Reason) CheckStepUp(ClaimsPrincipal u, DateTimeOffset now)
    {
        if (u.FindFirstValue("acme_level") != "LoA2") return (false, "So far you signed in with a password only (LoA1). This action needs password + authenticator code (LoA2).");
        if (!long.TryParse(u.FindFirstValue("acme_auth_instant"), out var at)) return (false, "The login time is unknown.");
        var age = now.ToUnixTimeSeconds() - at;
        if (age > s.WindowSeconds + s.SkewSeconds) return (false, $"Your last verification was {age} seconds ago. It counts for {s.WindowSeconds} seconds.");
        return (true, "");
    }

    public string Perform(string action, string arg)
    {
        lock (_l)
        {
            switch (action)
            {
                case "release-payment":
                    var i = _payments.FindIndex(p => p.Id == arg && p.Status == "held");
                    if (i < 0) return "Payment not found.";
                    _payments[i] = _payments[i] with { Status = "released" };
                    return $"Payment {arg} released.";
                case "add-approver":
                    var name = arg.Trim();
                    if (name.Length is 0 or > 40 || !name.All(c => char.IsLetterOrDigit(c) || c is '.' or '-' or '_')) return "Invalid user name.";
                    if (!_approvers.Contains(name)) _approvers.Add(name);
                    return $"{name} is now an approver.";
                default: return "Unknown action.";
            }
        }
    }
    public static string Title(string action, string arg) => action switch { "release-payment" => $"Release payment {arg}", "add-approver" => $"Add approver {arg}", _ => action };
}
