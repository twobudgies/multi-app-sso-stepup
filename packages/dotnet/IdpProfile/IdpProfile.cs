using System.Text.Json;
using System.Text.Json.Serialization;

namespace Acme.IdpProfile;

public enum Level { LoA1 = 1, LoA2 = 2 }

public sealed class Capabilities
{
    public bool AcrValues { get; set; }
    public bool MaxAge { get; set; }
    public bool PromptLogin { get; set; }
    public bool ClaimsParam { get; set; }
    public bool EmitsAuthTime { get; set; }
    public bool EmitsAmr { get; set; }
}

public sealed class LevelRule
{
    public string Claim { get; set; } = "";
    public string Type { get; set; } = "string";
    public Dictionary<string, string[]> Map { get; set; } = new();
}

public sealed class AuthTimeRule { public string? Claim { get; set; } }

public sealed class StepUpRequest
{
    public Dictionary<string, string> AcrValues { get; set; } = new();
    public bool MaxAge { get; set; }
    public string PromptLogin { get; set; } = "never";
    public string? ClaimsParam { get; set; }
}

public sealed class ChallengeRule
{
    public string Type { get; set; } = "rfc9470";
    public string? AcrsValue { get; set; }
}

public sealed class Profile
{
    public string Name { get; set; } = "";
    public bool Tested { get; set; }
    public Capabilities Capabilities { get; set; } = new();
    public LevelRule Level { get; set; } = new();
    public AuthTimeRule AuthTime { get; set; } = new();
    public StepUpRequest StepUpRequest { get; set; } = new();
    public ChallengeRule Challenge { get; set; } = new();

    static readonly JsonSerializerOptions Opts = new() { PropertyNameCaseInsensitive = true };

    /// <summary>Loads and validates a profile. Fails fast with a clear message.</summary>
    public static Profile Load(string path)
    {
        if (!File.Exists(path)) throw new InvalidOperationException($"IdP profile file not found: {path}");
        var p = JsonSerializer.Deserialize<Profile>(File.ReadAllText(path), Opts)
                ?? throw new InvalidOperationException("IdP profile is empty");
        p.Validate();
        return p;
    }

    /// <summary>Resolves idp/profiles/{IDP_PROFILE}.json by walking up from the base directory.</summary>
    public static Profile FromEnvironment(string? name = null)
    {
        name ??= Environment.GetEnvironmentVariable("IDP_PROFILE") ?? "keycloak";
        if (name.Any(c => !(char.IsLetterOrDigit(c) || c == '-' || c == '_')))
            throw new InvalidOperationException("IDP_PROFILE may only contain letters, digits, - and _");
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            var f = Path.Combine(dir.FullName, "idp", "profiles", name + ".json");
            if (File.Exists(f)) return Load(f);
            dir = dir.Parent;
        }
        throw new InvalidOperationException($"idp/profiles/{name}.json not found");
    }

    void Validate()
    {
        if (string.IsNullOrWhiteSpace(Name)) throw new InvalidOperationException("profile.name missing");
        if (string.IsNullOrWhiteSpace(Level.Claim)) throw new InvalidOperationException("profile.level.claim missing");
        if (!Level.Map.ContainsKey("LoA1") || !Level.Map.ContainsKey("LoA2"))
            throw new InvalidOperationException("profile.level.map needs LoA1 and LoA2");
        if (Capabilities.EmitsAuthTime && string.IsNullOrEmpty(AuthTime.Claim))
            throw new InvalidOperationException("profile says it emits auth time but authTime.claim is empty");
        if (!StepUpRequest.AcrValues.ContainsKey("LoA2") && !(Capabilities.ClaimsParam && !string.IsNullOrEmpty(StepUpRequest.ClaimsParam)))
            throw new InvalidOperationException("profile has no way to request LoA2");
        if (Level.Map["LoA2"].Length == 0)
            throw new InvalidOperationException("profile.level.map.LoA2 has no accepted values");
    }

    /// <summary>Policy safety check: a max-age rule cannot be enforced without an auth time claim.</summary>
    public void EnsureCanEnforce(bool anyActionHasMaxAge)
    {
        if (anyActionHasMaxAge && (!Capabilities.EmitsAuthTime || string.IsNullOrEmpty(AuthTime.Claim)))
            throw new InvalidOperationException(
                $"Profile '{Name}' cannot provide an authentication time, but a policy has a max age. Refusing to start instead of skipping the check.");
    }

    // ---- Evaluator (authoritative in the API) ----
    public Level? ReadLevel(IEnumerable<(string Type, string Value)> claims)
    {
        var values = claims.Where(c => c.Type == Level.Claim).Select(c => c.Value).ToList();
        Level? best = null;
        foreach (var (name, accepted) in Level.Map)
            if (values.Any(v => accepted.Contains(v)) && Enum.TryParse<Level>(name, out var l) && (best == null || l > best)) best = l;
        return best;
    }

    public long? ReadAuthTime(IEnumerable<(string Type, string Value)> claims)
    {
        if (string.IsNullOrEmpty(AuthTime.Claim)) return null;
        var v = claims.FirstOrDefault(c => c.Type == AuthTime.Claim).Value;
        return long.TryParse(v, out var t) ? t : null;
    }

    public Decision Evaluate(IEnumerable<(string Type, string Value)> claims, Level required, int? maxAgeSeconds, DateTimeOffset now, int skewSeconds)
    {
        var claimList = claims.ToList();
        var level = ReadLevel(claimList);
        var authTime = ReadAuthTime(claimList);
        if (level == null || level < required)
            return Decision.Deny("level_too_low", $"Requires {required}, token has {(level?.ToString() ?? "unknown")}");
        if (maxAgeSeconds is int max)
        {
            if (authTime is null) return Decision.Deny("auth_time_missing", "Token has no authentication time");
            var age = now.ToUnixTimeSeconds() - authTime.Value;
            // negative age beyond skew means the IdP clock is ahead; treat as unsafe
            if (age > max + skewSeconds) return Decision.Deny("auth_too_old", $"Authentication is {age}s old, limit {max}s");
            if (age < -skewSeconds) return Decision.Deny("auth_time_in_future", "Token authentication time is in the future");
        }
        return Decision.Allow();
    }

    // ---- Request builder ----
    public Dictionary<string, string> BuildStepUpParameters(Level required, int? maxAgeSeconds)
    {
        var p = new Dictionary<string, string>();
        if (Capabilities.AcrValues && StepUpRequest.AcrValues.TryGetValue(required.ToString(), out var acr)) p["acr_values"] = acr;
        if (Capabilities.MaxAge && StepUpRequest.MaxAge && maxAgeSeconds is int m) p["max_age"] = m.ToString();
        if (Capabilities.PromptLogin && StepUpRequest.PromptLogin == "always") p["prompt"] = "login";
        if (Capabilities.ClaimsParam && !string.IsNullOrEmpty(StepUpRequest.ClaimsParam))
            p["claims"] = StepUpRequest.ClaimsParam.Replace("{level}", Level.Map["LoA2"].FirstOrDefault() ?? "");
        return p;
    }

    /// <summary>RFC 9470 WWW-Authenticate header value.</summary>
    public string BuildChallenge(Level required, int? maxAgeSeconds)
    {
        if (Challenge.Type == "entra-claims")
        {
            var claims = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(
                "{\"access_token\":{\"acrs\":{\"essential\":true,\"value\":\"" + (Challenge.AcrsValue ?? Level.Map["LoA2"].FirstOrDefault() ?? "") + "\"}}}"));
            return $"Bearer realm=\"\", error=\"insufficient_claims\", claims=\"{claims}\", cc_type=\"authcontext\"";
        }
        var p = BuildStepUpParameters(required, maxAgeSeconds);
        var s = "Bearer error=\"insufficient_user_authentication\", error_description=\"A stronger or more recent authentication is required\"";
        foreach (var (k, v) in p) if (k is "acr_values" or "max_age") s += $", {k}=\"{v}\"";
        return s;
    }
}

public sealed record Decision(bool Allowed, string Code, string Message)
{
    public static Decision Allow() => new(true, "ok", "");
    public static Decision Deny(string code, string msg) => new(false, code, msg);
}
