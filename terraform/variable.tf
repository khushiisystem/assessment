variable "aws_region" {
  default = "ap-southeast-1"
}

variable "app_name" {
  default = "my-app"
}

variable "frontend_image" {
  description = "Frontend ECR image URL"
  default     = ""
}

variable "backend_image" {
  description = "Backend ECR image URL"
  default     = ""
}
