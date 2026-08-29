import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { isLoggedIn } from '../api/client'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/RegisterView.vue'),
    meta: { public: true },
  },
  {
    path: '/register/confirm',
    name: 'register-confirm',
    component: () => import('../views/ConfirmView.vue'),
    meta: { public: true },
  },
  {
    path: '/self-register',
    name: 'self-register',
    component: () => import('../views/SelfRegisterView.vue'),
    meta: { public: true },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('../views/ForgotPasswordView.vue'),
    meta: { public: true },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('../views/ResetPasswordView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    name: 'shows',
    component: () => import('../views/ShowsView.vue'),
  },
  {
    path: '/shows/:id',
    name: 'show-detail',
    component: () => import('../views/ShowDetailView.vue'),
    props: true,
  },
  {
    path: '/network',
    name: 'network',
    component: () => import('../views/NetworkView.vue'),
  },
  {
    path: '/archive',
    name: 'archive',
    component: () => import('../views/ArchiveView.vue'),
  },
  {
    path: '/templates',
    name: 'templates',
    component: () => import('../views/TemplatesView.vue'),
  },
  {
    path: '/settings',
    component: () => import('../views/SettingsView.vue'),
    children: [
      { path: '', redirect: '/settings/account' },
      { path: 'account', name: 'settings-account', component: () => import('../views/settings/AccountView.vue') },
      { path: 'display', name: 'settings-display', component: () => import('../views/settings/DisplayView.vue') },
      { path: 'server', name: 'settings-server', component: () => import('../views/settings/ServerView.vue') },
      { path: 'backup', name: 'settings-backup', component: () => import('../views/settings/BackupView.vue') },
      { path: 'users', name: 'settings-users', component: () => import('../views/settings/UsersView.vue') },
      { path: 'smtp', name: 'settings-smtp', component: () => import('../views/settings/SmtpView.vue') },
      { path: 'update', name: 'settings-update', component: () => import('../views/settings/UpdateView.vue') },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
    meta: { public: true },
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (!to.meta.public && !isLoggedIn()) return { name: 'login' }
})

