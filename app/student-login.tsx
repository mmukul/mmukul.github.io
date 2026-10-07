import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { WebView } from 'react-native-webview'
import { Screen } from '../components/Screen'
import { theme } from '../theme'

const URL = 'https://nextgendevsecops.in/student-portal/login.html?v=61'

const MOBILE_JS = `
(function(){
  function apply(){
    try{
      var style=document.getElementById('nextgen-student-mobile');
      if(!style){
        style=document.createElement('style');
        style.id='nextgen-student-mobile';
        style.textContent=''
          + 'html,body{width:100%!important;min-width:0!important;margin:0!important;padding:0!important;overflow-x:hidden!important;box-sizing:border-box!important;}'
          + '*,*:before,*:after{box-sizing:border-box!important;}'
          + 'body{padding:6px!important;background:#070914!important;}'
          + '.box{width:100%!important;max-width:420px!important;margin:0 auto!important;padding:13px 11px!important;border-radius:16px!important;}'
          + 'input,button{max-width:100%!important;width:100%!important;}'
          + '#turnstile{width:132px!important;max-width:132px!important;min-width:132px!important;height:124px!important;min-height:124px!important;max-height:124px!important;overflow:hidden!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;margin:3px auto 4px!important;padding:0!important;}'
          + '.cf-turnstile{width:150px!important;min-width:150px!important;max-width:150px!important;height:140px!important;min-height:140px!important;max-height:140px!important;transform:scale(.88)!important;transform-origin:top center!important;margin:0 auto!important;overflow:hidden!important;}'
          + '#turnstile iframe{width:150px!important;max-width:150px!important;height:140px!important;max-height:140px!important;}'
          + 'h1{font-size:24px!important;line-height:1.15!important;margin:5px 0 7px!important;}'
          + '.sub{font-size:12px!important;line-height:1.5!important;}'
          + '.back{font-size:12px!important;}'
          + '@media(max-width:380px){body{padding:5px!important}.box{padding:12px 10px!important}h1{font-size:22px!important}}';
        document.head.appendChild(style);
      }
    }catch(e){}
  }
  function compactTurnstile(){
    try{
      if(!window.turnstile || window.turnstile.__nextgenCompactPatched)return;
      var original=window.turnstile.render;
      if(typeof original!=='function')return;
      window.turnstile.render=function(container,options){
        var opts=Object.assign({},options||{}, {size:'compact'});
        return original.call(window.turnstile,container,opts);
      };
      window.turnstile.__nextgenCompactPatched=true;
    }catch(e){}
  }
  function run(){apply();compactTurnstile();}
  run();
  var tries=0;
  var timer=setInterval(function(){run();if(++tries>80)clearInterval(timer);},100);
  try{new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}
})();true;
`

export default function StudentLogin() {
  const { height } = useWindowDimensions()
  const webHeight = Math.max(560, Math.min(760, height - 112))

  return <Screen>
    <View style={styles.head}>
      <Text style={styles.kicker}>STUDENT PORTAL</Text>
      <Text style={styles.title}>Student Login</Text>
      <Text style={styles.text}>Secure access to your courses, labs and learning resources.</Text>
    </View>
    <View style={[styles.webWrap, { height: webHeight }]}>
      <WebView
        source={{ uri: URL }}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        setSupportMultipleWindows={false}
        javaScriptCanOpenWindowsAutomatically={false}
        onShouldStartLoadWithRequest={(request) => {
          try {
            const url = String(request.url || '')
            return [
              'https://nextgendevsecops.in/',
              'https://www.nextgendevsecops.in/',
              'https://challenges.cloudflare.com/',
              'https://hagen.challenges.cloudflare.com/',
              'https://brunhild.challenges.cloudflare.com/',
            ].some(prefix => url === prefix.slice(0, -1) || url.startsWith(prefix))
          } catch { return false }
        }}
        originWhitelist={['https://nextgendevsecops.in', 'https://www.nextgendevsecops.in', 'https://challenges.cloudflare.com', 'https://hagen.challenges.cloudflare.com', 'https://brunhild.challenges.cloudflare.com']}
        startInLoadingState
        injectedJavaScriptBeforeContentLoaded={MOBILE_JS}
        scalesPageToFit={false}
        automaticallyAdjustContentInsets={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={styles.web}
      />
    </View>
    <Text style={styles.security}>Protected by the website's Cloudflare security verification.</Text>
  </Screen>
}

const styles=StyleSheet.create({
  head:{marginBottom:7},
  kicker:{color:theme.colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.4},
  title:{color:'#fff',fontSize:25,lineHeight:30,fontWeight:'900',marginTop:4},
  text:{color:theme.colors.muted,fontSize:11.5,lineHeight:17,marginTop:4},
  webWrap:{width:'100%',borderRadius:15,overflow:'hidden',borderWidth:1,borderColor:'rgba(103,232,249,.20)',backgroundColor:'#070914'},
  web:{flex:1,backgroundColor:'#070914'},
  security:{color:'#8FA1B8',fontSize:9,lineHeight:13,textAlign:'center',marginTop:5,paddingHorizontal:8},
})
