using Microsoft.AspNetCore.Authentication;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

public record ApiResult(int Status, JsonElement Body, bool IsStepUp, string? Message, int? MaxAge);

public class ApiClient(HttpClient http, IHttpContextAccessor ctx)
{
    async Task<ApiResult> Send(HttpMethod m, string path, object? body)
    {
        var token = await ctx.HttpContext!.GetTokenAsync("access_token");
        var req = new HttpRequestMessage(m, path);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (body != null) req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var res = await http.SendAsync(req);
        var text = await res.Content.ReadAsStringAsync();
        var json = text.Length > 0 ? JsonDocument.Parse(text).RootElement.Clone() : default;
        var challenge = res.Headers.WwwAuthenticate.ToString();
        var stepUp = (int)res.StatusCode == 401 && challenge.Contains("insufficient_user_authentication");
        int? maxAge = null;
        var mm = System.Text.RegularExpressions.Regex.Match(challenge, "max_age=\"(\\d+)\"");
        if (mm.Success) maxAge = int.Parse(mm.Groups[1].Value);
        string? msg = json.ValueKind == JsonValueKind.Object && json.TryGetProperty("message", out var p) ? p.GetString() : null;
        return new ApiResult((int)res.StatusCode, json, stepUp, msg, maxAge);
    }
    public Task<ApiResult> Get(string path) => Send(HttpMethod.Get, path, null);
    public Task<ApiResult> Post(string path, object body) => Send(HttpMethod.Post, path, body);
}
