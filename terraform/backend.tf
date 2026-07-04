terraform {
  backend "s3" {
    bucket       = "zecdata-terraform-state-prod"
    key          = "prod/terraform.tfstate"
    region       = "ap-southeast-1"
    use_lockfile = true
    encrypt      = true
  }
}
