import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import type { Adapter } from 'next-auth/adapters'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role || 'user'
      }
      
      // セッション更新時（クライアントからupdate()が呼ばれた時）
      if (trigger === 'update' && session) {
        if (session.name) {
          token.name = session.name
        }
      }
      
      // Google認証の場合、初回ログイン時にroleを設定
      if (account?.provider === 'google' && user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: {
            gameAccounts: true,
          },
        })
        
        // 初回ログイン時に4つのゲームアカウントを自動作成
        if (dbUser && dbUser.gameAccounts.length === 0) {
          await prisma.gameAccount.createMany({
            data: [
              { userId: user.id, accountNumber: 1, name: '1' },
              { userId: user.id, accountNumber: 2, name: '2' },
              { userId: user.id, accountNumber: 3, name: '3' },
              { userId: user.id, accountNumber: 4, name: '4' },
            ],
          })
        }
        
        token.role = dbUser?.role || 'user'
      }
      return token
    },
    async session({ session, token, user }) {
      if (session.user) {
        session.user.id = (token.id || user?.id) as string
        session.user.role = (token.role || user?.role || 'user') as string
        // トークンから名前を取得（更新された場合はこちらが優先される）
        if (token.name) {
          session.user.name = token.name as string
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}
