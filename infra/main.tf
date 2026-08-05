terraform {
  required_version = ">= 1.5"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 5.7"
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

  build_command    = "npm run prisma:generate && npm run build"
  install_command  = "npm ci"
  output_directory = null

  oidc_token_config = {
    enabled = true
  }

  # 現在の値("all_except_custom_domains")は provider v1.14 の入力バリデーションが
  # 受け付ける enum(all_deployments/only_preview_deployments/none/standard_protection)
  # に含まれず、こちらから書き込めない。API側の実値をそのまま維持する。
  lifecycle {
    ignore_changes = [vercel_authentication]
  }
}
