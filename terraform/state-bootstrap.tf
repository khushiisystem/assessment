resource "aws_s3_bucket" "terraform_state" {
  bucket        = "zecdata-terraform-state-prod"
  force_destroy = true
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}
