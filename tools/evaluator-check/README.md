# tools/evaluator-check

Runs the API's step-up evaluator (`packages/dotnet/IdpProfile`) against synthetic claims with a shifted clock: exact limit, 5 s skew leeway, IdP clock ahead, LoA1, missing `auth_time`, unknown `acr`. Prints PASS/FAIL per case. Run: `dotnet run --project tools/evaluator-check`.
