import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import RazorpayCheckout from 'react-native-razorpay'
import { Screen } from '../components/Screen'
import { Turnstile, type TurnstileRef } from '../components/Turnstile'
import { theme } from '../theme'

const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_JlIrNdsEXgjikrh9F_YxYg_DBrgimoQ'
const CREATE_ORDER_ENDPOINT = 'https://hkpvigvtdckxhmnsvdrh.supabase.co/functions/v1/create-razorpay-order'
const VERIFY_PAYMENT_ENDPOINT = 'https://hkpvigvtdckxhmnsvdrh.supabase.co/functions/v1/verify-razorpay-payment'

const courseData = {
  devops: { title: 'DevOps Training', fee: '₹20,000', full: 20000, part: 10000 },
  'devsecops-foundational': { title: 'DevSecOps & Application Security — Foundational', fee: '₹25,000', full: 25000, part: 12500 },
  'devsecops-advanced': { title: 'DevSecOps & Application Security — Advanced', fee: '₹30,000', full: 30000, part: 15000 },
  genai: { title: 'GenAI & AI Security', fee: '₹25,000 • Launch Offer', full: 25000, part: 12500 },
} as const

type CourseKey = keyof typeof courseData
type Plan = 'full' | 'part1' | 'part2'

function amountFor(course: typeof courseData[CourseKey], plan: Plan) {
  return plan === 'full' ? course.full : course.part
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('91') && digits.length > 10) return digits.slice(2, 12)
  return digits.slice(0, 10)
}

export default function Payment() {
  const params = useLocalSearchParams<{ course?: string; title?: string }>()
  const courseKey = String(params.course || '') as CourseKey
  const selected = courseData[courseKey] || courseData.devops
  const [plan, setPlan] = useState<Plan>('full')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const captcha = useRef<TurnstileRef>(null)
  const amount = useMemo(() => amountFor(selected, plan), [selected, plan])

  const startPayment = async () => {
    const cleanName = name.trim().replace(/\s+/g, ' ')
    const cleanEmail = email.trim().toLowerCase()
    const cleanPhone = normalizePhone(phone)
    if (cleanName.length < 2) return Alert.alert('Name required', 'Please enter your full name.')
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return Alert.alert('Email required', 'Please enter a valid email address.')
    if (!/^\d{10}$/.test(cleanPhone)) return Alert.alert('Mobile required', 'Please enter a valid 10-digit mobile number.')
    if (!captchaToken) return Alert.alert('Security check required', 'Please complete the CAPTCHA before starting payment.')

    setBusy(true)
    setStatus('Starting secure Razorpay checkout…')
    try {
      const response = await fetch(CREATE_ORDER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          course_key: courseKey in courseData ? courseKey : 'devops',
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          plan,
          turnstile_token: captchaToken,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.order_id || !result.key_id || !Number.isFinite(Number(result.amount)) || Number(result.amount) <= 0) {
        throw new Error(result.error || `Payment service returned HTTP ${response.status}.`)
      }

      const orderAmount = Number(result.amount)
      const checkoutOptions = {
        key: String(result.key_id),
        amount: orderAmount,
        currency: String(result.currency || 'INR'),
        name: 'NextGen DevSecOps AI',
        description: `${selected.title} - ${plan === 'full' ? 'Full Payment' : plan === 'part1' ? 'Part 1' : 'Part 2'}`,
        order_id: String(result.order_id),
        prefill: { name: cleanName, email: cleanEmail, contact: `+91${cleanPhone}` },
        theme: { color: '#2563EB' },
        modal: { confirm_close: true, escape: true, handleback: true },
        notes: { course: selected.title, plan },
      }

      setStatus('Opening Razorpay…')
      const payment = await RazorpayCheckout.open(checkoutOptions)
      setStatus('Payment received. Verifying securely…')

      const verifyResponse = await fetch(VERIFY_PAYMENT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          order_id: payment.razorpay_order_id,
          payment_id: payment.razorpay_payment_id,
          signature: payment.razorpay_signature,
        }),
      })
      const verified = await verifyResponse.json().catch(() => ({}))
      if (!verifyResponse.ok) throw new Error(verified.error || 'Payment verification failed.')

      if (verified.status === 'paid') {
        setStatus(`Payment confirmed ✓\nReference: ${String(verified.reference || payment.razorpay_payment_id)}`)
        setBusy(false)
        return
      }
      setStatus('Payment is processing. Server-side confirmation is still pending.')
    } catch (error) {
      setStatus('')
      Alert.alert('Payment not completed', error instanceof Error ? error.message : 'Please try again.')
      captcha.current?.reset()
      setCaptchaToken('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <View style={styles.head}>
        <Text style={styles.kicker}>SECURE COURSE ENROLLMENT</Text>
        <Text style={styles.title}>Enroll & Pay Securely</Text>
        <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86} style={styles.text}>{selected.title}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.courseFee}>{selected.fee}</Text>
        <Text style={styles.label}>PAYMENT PLAN</Text>
        <View style={styles.plans}>
          {(['full', 'part1', 'part2'] as Plan[]).map(item => (
            <Pressable key={item} disabled={busy} onPress={() => setPlan(item)} style={[styles.plan, plan === item && styles.planActive]}>
              <Text style={styles.planTitle}>{item === 'full' ? 'Full Payment' : item === 'part1' ? 'Part 1' : 'Part 2'}</Text>
              <Text style={styles.planAmount}>₹{amountFor(selected, item).toLocaleString('en-IN')}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>AMOUNT TO PAY</Text>
          <Text style={styles.summaryAmount}>₹{amount.toLocaleString('en-IN')}</Text>
        </View>

        <Text style={styles.label}>YOUR DETAILS</Text>
        <TextInput value={name} onChangeText={setName} editable={!busy} placeholder="Full name" placeholderTextColor="#8295B9" style={styles.input} maxLength={100} />
        <TextInput value={email} onChangeText={setEmail} editable={!busy} placeholder="Email address" placeholderTextColor="#8295B9" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.input} maxLength={160} />
        <TextInput value={phone} onChangeText={v => setPhone(normalizePhone(v))} editable={!busy} placeholder="10-digit mobile number" placeholderTextColor="#8295B9" keyboardType="phone-pad" style={styles.input} maxLength={10} />

        <View style={styles.securityBox}>
          <View style={styles.securityHead}>
            <Text style={styles.securityTitle}>SECURITY CHECK</Text>
            <Text style={styles.securityState}>{captchaToken ? 'Verified ✓' : 'Required'}</Text>
          </View>
          <Turnstile ref={captcha} onToken={setCaptchaToken} />
        </View>

        <Pressable accessibilityRole="button" disabled={busy} onPress={startPayment} style={({ pressed }) => [styles.pay, busy && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.payText}>{busy ? 'PROCESSING…' : `PAY ₹${amount.toLocaleString('en-IN')} WITH RAZORPAY →`}</Text>
        </Pressable>
        {status ? <Text style={styles.status}>{status}</Text> : null}
        <Text style={styles.note}>Razorpay securely processes the payment. Payment confirmation is verified server-side. Never share your UPI PIN, OTP, CVV or card PIN.</Text>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← BACK TO COURSES</Text>
      </Pressable>
    </Screen>
  )
}

const styles=StyleSheet.create({
  head:{marginBottom:5},
  kicker:{color:theme.colors.accent,fontSize:9,fontWeight:'900',letterSpacing:1.35},
  title:{color:'#fff',fontSize:23,lineHeight:28,fontWeight:'900',marginTop:3},
  text:{color:theme.colors.muted,fontSize:11,lineHeight:16,marginTop:2},
  card:{backgroundColor:theme.colors.surface,borderColor:theme.colors.border,borderWidth:1,borderRadius:15,padding:12},
  courseFee:{color:theme.colors.accent,fontSize:13,fontWeight:'900',marginBottom:6},
  label:{color:theme.colors.accent,fontSize:8.5,fontWeight:'900',letterSpacing:1.1,marginTop:3,marginBottom:5},
  plans:{gap:5},
  plan:{minHeight:43,borderRadius:10,borderWidth:1,borderColor:'rgba(148,163,184,.22)',backgroundColor:'#0A1225',paddingHorizontal:11,paddingVertical:7,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  planActive:{borderColor:'#67E8F9',backgroundColor:'#15152F'},
  planTitle:{color:'#E8F2FF',fontSize:10,fontWeight:'900'},
  planAmount:{color:'#67E8F9',fontSize:11,fontWeight:'900'},
  summary:{marginTop:7,padding:8,borderRadius:10,borderWidth:1,borderColor:'rgba(103,232,249,.20)',backgroundColor:'#0A1225',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  summaryLabel:{color:'#8FA1B8',fontSize:8,fontWeight:'900',letterSpacing:1},
  summaryAmount:{color:'#67E8F9',fontSize:15,fontWeight:'900'},
  input:{color:'#fff',backgroundColor:theme.colors.surfaceSoft,borderColor:'rgba(148,163,184,.24)',borderWidth:1,borderRadius:11,paddingHorizontal:12,paddingVertical:10,marginBottom:6,fontSize:12.5},
  securityBox:{borderWidth:1,borderColor:'rgba(103,232,249,.22)',borderRadius:11,backgroundColor:'#0A1225',padding:6,alignItems:'center',overflow:'hidden',marginTop:1},
  securityHead:{width:'100%',flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:2},
  securityTitle:{color:'#67E8F9',fontSize:8,fontWeight:'900',letterSpacing:1},
  securityState:{color:'#8FA1B8',fontSize:8,fontWeight:'800'},
  pay:{minHeight:48,borderRadius:11,backgroundColor:'#2563EB',borderWidth:1,borderColor:'#A5F3FC',shadowColor:'#2563EB',shadowOpacity:.20,shadowRadius:9,shadowOffset:{width:0,height:4},alignItems:'center',justifyContent:'center',paddingHorizontal:10,marginTop:8},
  payText:{color:'#fff',fontSize:10,fontWeight:'900',letterSpacing:.2,textAlign:'center'},
  status:{color:'#BFEAFF',fontSize:10,lineHeight:15,textAlign:'center',marginTop:6},
  note:{color:'#8FA1B8',fontSize:8.5,lineHeight:13,textAlign:'center',marginTop:6},
  back:{minHeight:38,borderRadius:10,borderWidth:1,borderColor:'rgba(165,180,252,.28)',backgroundColor:'#15152F',alignItems:'center',justifyContent:'center',marginTop:6},
  backText:{color:'#D9FBFF',fontSize:9,fontWeight:'900',letterSpacing:.25},
  disabled:{opacity:.55},pressed:{opacity:.82,transform:[{scale:.985}]},
})
