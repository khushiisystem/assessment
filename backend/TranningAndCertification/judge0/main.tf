terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region  = "ap-south-1"
  profile = "default"
}

##########################
# Data Sources (Default) #
##########################

data "aws_vpc" "default" {
  default = true
}

data "aws_subnet" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }

  filter {
    name   = "availability-zone"
    values = ["ap-south-1a"]
  }

  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

#####################
# Input Variables   #
#####################

variable "ami_id" {
  description = "AMI ID of the pre-configured Judge0 image"
  type        = string
  default     = "ami-087d1c9a513324697"
}

variable "instance_type" {
  description = "Instance type for Judge0 server"
  type        = string
  default     = "t3.small"
}

#####################
# Key Pair Creation #
#####################

resource "tls_private_key" "judge0_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "judge0_key" {
  key_name   = "judge0-key"
  public_key = tls_private_key.judge0_key.public_key_openssh
}

resource "local_file" "judge0_pem" {
  content         = tls_private_key.judge0_key.private_key_pem
  filename        = "${path.module}/judge0-key.pem"
  file_permission = "0400"
}

#####################
# Security Group    #
#####################

resource "aws_security_group" "judge0_sg" {
  name        = "judge0-sg"
  description = "Allow SSH and HTTP only"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Allow HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "judge0-sg"
  }
}

###########################
# EC2 Instance Definition #
###########################

resource "aws_instance" "judge0" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.judge0_key.key_name
  subnet_id              = data.aws_subnet.default.id
  vpc_security_group_ids = [aws_security_group.judge0_sg.id]

  root_block_device {
    volume_size = 20
  }

  user_data = file("${path.module}/judge0-userdata-script.sh")

  tags = {
    Name = "Judge0-Server"
  }
}

################
# Outputs      #
################

output "public_ip" {
  description = "Public IP of the Judge0 instance"
  value       = aws_instance.judge0.public_ip
}

output "instance_id" {
  description = "Instance ID"
  value       = aws_instance.judge0.id
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i judge0-key.pem ubuntu@${aws_instance.judge0.public_ip} \"sudo tail -f /var/log/judge0-userdata.log\""
}
