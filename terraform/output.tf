output "frontend_ecr_url" {
  value = aws_ecr_repository.frontend.repository_url
}

output "backend_ecr_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "mysql_ecr_url" {
  value = aws_ecr_repository.mysql.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ec2_public_ips" {
  value = data.aws_instances.ecs_instances.public_ips
}
