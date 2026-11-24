/** Same-origin profile API gateway for standalone Ciyan. */
export default {
  async fetch(request,env){
    if(new URL(request.url).pathname.startsWith('/_translation/')){
      if(!env.COMMON)return new Response('Translation service binding missing',{status:503});
      return env.COMMON.fetch(request);
    }
    if(new URL(request.url).pathname.startsWith('/_profiles/')){
      if(!env.PROFILES)return new Response('Profile service binding missing',{status:503});
      return env.PROFILES.fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};
