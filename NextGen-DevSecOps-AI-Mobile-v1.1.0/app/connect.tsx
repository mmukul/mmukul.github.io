import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Screen } from '../components/Screen'
import { SectionTitle } from '../components/SectionTitle'
import { Turnstile, type TurnstileRef } from '../components/Turnstile'
import { theme } from '../theme'

const options = ['Demo Session', 'Course Enrollment', 'Individual Training', 'Corporate Training', 'Interview Preparation', 'Consulting & Advisory']
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_JlIrNdsEXgjikrh9F_YxYg_DBrgimoQ'
const ENQUIRY_ENDPOINT = 'https://hkpvigvtdckxhmnsvdrh.supabase.co/functions/v1/submit-contact-enquiry'

function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  return digits.slice(0, 10)
}

export default function Connect() {
  const params = useLocalSearchParams<{ context?: string; course?: string }>()
  const [context, setContext] = useState(String(params.context || ''))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [requirement, setRequirement] = useState(String(params.course ? `${params.context === 'Course Enrollment' ? 'Enrollment request for' : 'Demo request for'}: ${params.course}` : ''))
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaReset, setCaptchaReset] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [phoneTouched, setPhoneTouched] = useState(false)
  const captcha = useRef<TurnstileRef>(null)

  useEffect(() => { if (params.context) setContext(String(params.context)); if (params.course && !requirement) setRequirement(`${String(params.context) === 'Course Enrollment' ? 'Enrollment request for' : 'Demo request for'}: ${String(params.course)}`) }, [params.context, params.course])

  const phoneValid = /^\d{10}$/.test(phone)
  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim())

  const submit = async () => {
    setPhoneTouched(true)
    if (!context || name.trim().length < 2 || !phoneValid || !emailValid || !requirement.trim()) {
      Alert.alert('Check your details', 'Select a service and enter your name, valid 10-digit mobile number, email and requirement.')
      return
    }
    if (!captchaToken) {
      Alert.alert('Security check required', 'Please complete the security verification before submitting.')
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch(ENQUIRY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          context,
          course: '',
          name: name.trim(),
          phone,
          email: email.trim().toLowerCase(),
          preferred_engagement: '',
          goal: requirement.trim(),
          turnstile_token: captchaToken,
        }),
      })
      const out = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(out.error || 'Unable to submit enquiry. Please try again.')
      setCaptchaToken('')
      setCaptchaReset(v => v + 1)

      const message = [
        'Hello NextGen DevSecOps AI,',
        '',
        `Service: ${context}`,
        `Name: ${name.trim()}`,
        `Mobile: ${phone}`,
        `Email: ${email.trim().toLowerCase()}`,
        `Requirement: ${requirement.trim()}`,
        out.reference ? `Reference: ${out.reference}` : '',
      ].filter(Boolean).join('\n')
      const waUrl = `https://wa.me/917769929666?text=${encodeURIComponent(message)}`
      try {
        await Linking.openURL(waUrl)
      } catch {
        Alert.alert('Enquiry submitted', `${out.reference ? `Reference: ${out.reference}. ` : ''}Your enquiry was saved, but WhatsApp could not be opened on this device.`)
      }
    } catch (error) {
      setCaptchaToken('')
      setCaptchaReset(v => v + 1)
      Alert.alert('Submission failed', error instanceof Error ? error.message : 'Unable to submit enquiry. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen>
      <SectionTitle kicker="LET’S CONNECT" title={context === 'Demo Session' ? 'Request a Demo Session.' : context === 'Course Enrollment' ? 'Enroll in a Course.' : 'Tell me what you need.'} text="Choose a service and share a few details. Secure submission is protected by the same Cloudflare Turnstile verification used on the website." />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <Text style={styles.label}>SERVICE</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose a service" onPress={() => setPickerOpen(true)} style={({ pressed }) => [styles.selectLike, pressed && styles.pressed]}>
            <Text style={[styles.selectText, !context && styles.placeholder]}>{context || 'Choose a service'}</Text>
            <Text style={styles.chevron}>⌄</Text>
          </Pressable>
          <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
            <Pressable style={styles.pickerBackdrop} onPress={() => setPickerOpen(false)}>
              <Pressable style={styles.pickerSheet} onPress={() => {}}>
                <View style={styles.pickerHandle} />
                <Text style={styles.pickerTitle}>Choose a service</Text>
                {options.map(option => <Pressable key={option} accessibilityRole="button" onPress={() => { setContext(option); setPickerOpen(false) }} style={({ pressed }) => [styles.option, context === option && styles.optionSelected, pressed && styles.optionPressed]}>
                  <Text style={[styles.optionText, context === option && styles.optionSelectedText]}>{option}</Text>
                  {context === option ? <Text style={styles.optionCheck}>✓</Text> : null}
                </Pressable>)}
              </Pressable>
            </Pressable>
          </Modal>

          <Text style={styles.label}>NAME</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#6F809D" maxLength={100} autoCapitalize="words" style={styles.input} />

          <Text style={styles.label}>PHONE / MOBILE</Text>
          <View style={[styles.phoneWrap, phoneTouched && !phoneValid && styles.phoneInvalid, phoneValid && styles.phoneValid]}>
            <TextInput
              value={phone}
              onChangeText={v => setPhone(normalizeMobile(v))}
              onBlur={() => setPhoneTouched(true)}
              placeholder="10-digit mobile number"
              placeholderTextColor="#6F809D"
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={10}
              style={styles.phoneInput}
              textContentType="telephoneNumber"
              autoComplete="tel"
            />
            {phoneValid ? <Text style={styles.validMark}>✓</Text> : null}
          </View>
          {phoneTouched && !phoneValid ? <Text style={styles.errorText}>Enter exactly 10 digits.</Text> : <Text style={styles.helperText}>10-digit mobile number</Text>}

          <Text style={styles.label}>EMAIL</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#6F809D" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={160} style={[styles.input, email.length > 0 && !emailValid && styles.inputInvalid]} />
          <Text style={styles.label}>REQUIREMENT</Text>
          <TextInput value={requirement} onChangeText={setRequirement} placeholder="Briefly tell me what you need." placeholderTextColor="#6F809D" multiline maxLength={400} textAlignVertical="top" style={[styles.input, styles.multiline]} />

          <View style={styles.securityHead}><Text style={styles.securityTitle}>SECURITY CHECK</Text><Text style={styles.securityHint}>{captchaToken ? 'Verified ✓' : 'Required before submit'}</Text></View>
          <Turnstile key={captchaReset} ref={captcha} onToken={setCaptchaToken} />

          <Pressable accessibilityRole="button" accessibilityLabel="Submit enquiry securely" disabled={submitting} style={({ pressed }) => [styles.button, (!captchaToken || submitting) && styles.buttonDisabled, pressed && styles.pressed]} onPress={submit}>
            <Text style={styles.buttonText}>{submitting ? 'SUBMITTING…' : 'SUBMIT ENQUIRY SECURELY'}</Text><Text style={styles.buttonArrow}>→</Text>
          </Pressable>
          <Text style={styles.note}>Your enquiry is saved securely first. WhatsApp then opens with a prefilled message; if WhatsApp is unavailable, your enquiry remains saved.</Text>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card:{backgroundColor:theme.colors.surface,borderColor:'rgba(165,180,252,.22)',borderWidth:1,borderRadius:16,padding:12,shadowColor:'#000',shadowOpacity:.18,shadowRadius:12,shadowOffset:{width:0,height:5}},
  label:{color:theme.colors.accent,fontSize:8.5,fontWeight:'900',letterSpacing:1.2,marginBottom:4,marginTop:2},
  input:{color:theme.colors.text,backgroundColor:'#0A1225',borderColor:'rgba(148,163,184,.24)',borderWidth:1,borderRadius:12,paddingHorizontal:12,paddingVertical:10,marginBottom:7,fontSize:13},
  inputInvalid:{borderColor:'#F87171'},
  selectLike:{backgroundColor:theme.colors.surfaceSoft,borderColor:'rgba(103,232,249,.30)',borderWidth:1,borderRadius:12,paddingHorizontal:13,minHeight:44,marginBottom:6,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  selectText:{color:'#F4F7FF',fontSize:13,fontWeight:'700'}, placeholder:{color:'#6F809D',fontWeight:'600'}, chevron:{color:theme.colors.accent,fontSize:10,fontWeight:'900'},
  optionBox:{backgroundColor:'#10162A',borderColor:'rgba(103,232,249,.28)',borderWidth:1,borderRadius:12,overflow:'hidden',marginBottom:10},
  pickerBackdrop:{flex:1,backgroundColor:'rgba(2,8,23,.72)',justifyContent:'flex-end'}, pickerSheet:{backgroundColor:'#10162A',borderTopLeftRadius:24,borderTopRightRadius:24,borderWidth:1,borderColor:'rgba(165,180,252,.30)',padding:14,paddingBottom:22,shadowColor:'#000',shadowOpacity:.35,shadowRadius:22,shadowOffset:{width:0,height:-8}}, pickerHandle:{alignSelf:'center',width:42,height:4,borderRadius:4,backgroundColor:'#53658F',marginBottom:12}, pickerTitle:{color:'#FFFFFF',fontSize:16,fontWeight:'900',marginBottom:8},
  option:{paddingHorizontal:13,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'rgba(148,163,184,.16)',flexDirection:'row',alignItems:'center',justifyContent:'space-between'}, optionSelected:{backgroundColor:'#15152F'}, optionPressed:{backgroundColor:'#202B4B'}, optionText:{color:'#F2F7FF',fontSize:12.5,fontWeight:'700'}, optionSelectedText:{color:'#67E8F9'}, optionCheck:{color:'#67E8F9',fontSize:18,fontWeight:'900'},
  phoneWrap:{flexDirection:'row',alignItems:'center',backgroundColor:'#0A1225',borderColor:'rgba(148,163,184,.24)',borderWidth:1,borderRadius:12,marginBottom:2,minHeight:44}, phoneInvalid:{borderColor:'#F87171'}, phoneValid:{borderColor:'#55E6B8'},
  code:{color:theme.colors.textSoft,fontWeight:'900'}, phoneInput:{flex:1,color:theme.colors.text,paddingVertical:12,paddingHorizontal:10,fontSize:13}, validMark:{color:'#55E6B8',fontSize:17,fontWeight:'900',paddingRight:12},
  helperText:{color:'#6F809D',fontSize:9.5,marginBottom:8,marginTop:2}, errorText:{color:'#FCA5A5',fontSize:9.5,marginBottom:8,marginTop:2},
  multiline:{minHeight:88},
  securityHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:2,marginBottom:4}, securityTitle:{color:theme.colors.accent,fontSize:8.5,fontWeight:'900',letterSpacing:1.2}, securityHint:{color:'#A5B4C8',fontSize:9,fontWeight:'700'},
  button:{backgroundColor:'#06B6D4',borderColor:'#A5F3FC',borderWidth:1,borderRadius:12,minHeight:46,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'center',marginTop:2}, buttonDisabled:{opacity:.48},
  buttonText:{color:theme.colors.accentText,fontWeight:'900',fontSize:10.5,letterSpacing:.35}, buttonArrow:{color:theme.colors.accentText,fontSize:18,fontWeight:'900',marginLeft:7,marginTop:-1},
  note:{color:theme.colors.muted2,fontSize:9.5,lineHeight:14,marginTop:8}, pressed:{opacity:.82,transform:[{scale:.985}]},
})
