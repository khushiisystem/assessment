terraform {
  backend "s3" {
    bucket       = "my-app-terraform-state"
    key          = "prod/terraform.tfstate"
    region       = "ap-southeast-1"
    use_lockfile = true
    encrypt      = true
  }
}
