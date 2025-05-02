export const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  authorizationParams: {
    redirect_uri: import.meta.env.VITE_AUTH0_CALLBACK_URL,
    audience: `https://${import.meta.env.VITE_AUTH0_DOMAIN}/api/v2/`,
    scope: 'openid profile email',
  },
}; 