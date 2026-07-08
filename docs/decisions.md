# MVP decisions

- Imported products default to `DRAFT` and `INTERNAL`.
- Public customer registration and Google OAuth are enabled.
- Google-created users receive only the `CUSTOMER` role.
- `PRODUCT_EDITOR` cannot publish; `CONTENT_APPROVER` approves and publishes.
- One seeded account is defined for each authenticated role.
- Deployment target: VPS, maximum budget USD 100/month.
- ASP Tech controls DNS for `asptech.vn`.

Test passwords are read from `SEED_TEST_PASSWORD`; no password is stored in source control.

