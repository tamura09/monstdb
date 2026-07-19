terraform {
  required_version = ">= 1.5"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
  }

  # state は aws-terraform リポジトリと同じS3バケットで管理する。
  # bucket/key/region はローカルでは infra/backend.hcl (gitignore対象) で、
  # CI では GitHub Actions の -backend-config フラグで注入する(partial backend config)。
  backend "s3" {}
}

provider "vercel" {
  api_token = var.vercel_api_token
  team      = var.vercel_team_id != "" ? var.vercel_team_id : null
}

resource "vercel_project" "monstdb" {
  name      = "monstdb"
  framework = "nextjs"

  git_repository = {
    type = "github"
    repo = "tamura09/monstdb"
  }

  build_command    = "npm run build"
  install_command  = "npm install"
  output_directory = null
}
