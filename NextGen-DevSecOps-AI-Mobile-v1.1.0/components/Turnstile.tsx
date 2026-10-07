import { forwardRef, useImperativeHandle, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'

export type TurnstileRef = { reset: () => void }
type Props = { onToken: (token: string) => void }

const SITE_URL = 'https://nextgendevsecops.in/?mobile_turnstile=1'
const SCRIPT = `
(function(){
  var sent=false;
  function send(type,value){window.ReactNativeWebView.postMessage(JSON.stringify({type:type,token:value||''}));}
  function setViewport(){
    try{
      var m=document.querySelector('meta[name="viewport"]');
      if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}
      m.content='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    }catch(e){}
  }
  function render(){
    if(!window.turnstile){setTimeout(render,150);return;}
    try{
      setViewport();
      document.body.innerHTML='';
      document.documentElement.style.cssText='width:150px!important;height:140px!important;margin:0!important;padding:0!important;overflow:hidden!important;background:transparent!important;';
      document.body.style.cssText='width:150px!important;height:140px!important;margin:0!important;padding:0!important;overflow:hidden!important;background:transparent!important;display:flex!important;justify-content:center!important;align-items:flex-start!important;';
      var box=document.createElement('div');
      box.id='mobile-turnstile';
      box.style.cssText='width:150px!important;height:140px!important;min-width:150px!important;min-height:140px!important;max-width:150px!important;max-height:140px!important;overflow:hidden!important;margin:0!important;padding:0!important;display:block!important;';
      document.body.appendChild(box);
      window.turnstile.render(box,{
        sitekey:'0x4AAAAAAFB-n4TRFrZBKY3q',
        theme:'dark',
        size:'compact',
        callback:function(token){sent=false;send('token',token)},
        'expired-callback':function(){send('token','')},
        'error-callback':function(code){send('error',String(code||''))},
        'timeout-callback':function(){send('token','')}
      });
    }catch(e){send('error',String(e&&e.message||'render-failed'));}
  }
  render();
})();true;`

export const Turnstile = forwardRef<TurnstileRef, Props>(function Turnstile({ onToken }, ref) {
  const web = useRef<WebView>(null)
  useImperativeHandle(ref, () => ({ reset: () => web.current?.reload() }), [])
  const message = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      onToken(data.type === 'token' ? String(data.token || '') : '')
    } catch { onToken('') }
  }
  return (
    <View style={styles.box}>
      <View style={styles.scaled}>
      <WebView
        ref={web}
        source={{ uri: SITE_URL }}
        injectedJavaScript={SCRIPT}
        onMessage={message}
        onError={() => onToken('')}
        onHttpError={() => onToken('')}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        mixedContentMode="never"
        originWhitelist={['https://nextgendevsecops.in', 'https://www.nextgendevsecops.in', 'https://challenges.cloudflare.com', 'https://hagen.challenges.cloudflare.com', 'https://brunhild.challenges.cloudflare.com']}
        scrollEnabled={false}
        automaticallyAdjustContentInsets={false}
        setSupportMultipleWindows={false}
        style={styles.web}
      />
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  box: { width: 132, height: 124, maxWidth: 132, maxHeight: 124, alignSelf: 'center', overflow: 'hidden', borderRadius: 9, backgroundColor: 'transparent' },
  scaled: { width: 150, height: 140, alignSelf: 'center', transform: [{ scale: 0.88 }] },
  web: { width: 150, height: 140, backgroundColor: 'transparent' },
})
