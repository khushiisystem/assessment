terraform {
  backend "s3" {
    bucket       = "my-app-terraform-state"
    key          = "prod/terraform.tfstate"
    region       = "ap-northeast-1"
    use_lockfile = true
    encrypt      = true
  }
}
