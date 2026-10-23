using Acme.IdpProfile;
var p = Profile.FromEnvironment("keycloak");
var now = DateTimeOffset.UtcNow;
(string, string)[] C(string acr, long at) => new[] { ("acr", acr), ("auth_time", at.ToString()) };
void T(string name, (string, string)[] c, bool expect) { var d = p.Evaluate(c, Level.LoA2, 60, now, 5); Console.WriteLine($"{(d.Allowed == expect ? "PASS" : "FAIL")} {name}: allowed={d.Allowed} {d.Code}"); }
long n = now.ToUnixTimeSeconds();
T("fresh 0s", C("2", n), true);
T("age 60s (limit)", C("2", n - 60), true);
T("age 65s (limit + 5s skew)", C("2", n - 65), true);
T("age 66s", C("2", n - 66), false);
T("IdP clock 4s ahead (age -4)", C("2", n + 4), true);
T("IdP clock 6s ahead (age -6)", C("2", n + 6), false);
T("LoA1 fresh", C("1", n), false);
T("no auth_time", new[] { ("acr", "2") }, false);
T("unknown acr", C("3", n), false);
Console.WriteLine("challenge: " + p.BuildChallenge(Level.LoA2, 60));
