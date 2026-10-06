---
paths:
  - "terraform/**/*"
---

# Terraform
- Never run `terraform apply`. Plans only: `terraform plan -out=tfplan`.
- Every resource gets `tags = local.common_tags`.
- State lives in the S3 backend; never add a local backend.
