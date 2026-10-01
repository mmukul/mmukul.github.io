import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Screen } from '../components/Screen'
import { SectionTitle } from '../components/SectionTitle'

export default function Connect() {
  const params = useLocalSearchParams<{ context?: string }>()
  const [context, setContext] = useState(params.context || '')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [requirement, setRequirement] = useState('')
  useEffect(() => { if (params.context) setContext(String(params.context)) }, [params.context])

  const submit = () => {
    const digits = phone.replace(/\D/g, '')
    // Keep the same 10-digit Indian mobile validation used by the website contact form.
    if (!context || !name.trim() || !/^\d{10}$/.test(digits) || !/^\S+@\S+\.\S+$/.test(email.trim()) || !requirement.trim()) {
      Alert.alert('Check your details', 'Please select what you need and enter your name, a valid 10-digit +91 mobile number, email and requirement.')
      return
    }
    Alert.alert('Ready for secure submission', 'Your details are valid. Secure enquiry submission will be connected in the next phase.')
  }

  return <Screen><SectionTitle kicker="LET’S CONNECT" title="Have a requirement?" text="Tell me briefly what you need. I’ll get back with the right next step." />
    <View style={styles.card}>
      <Text style={styles.label}>WHAT DO YOU NEED?</Text><View style={styles.selectLike}><Text style={styles.selectText}>{context || 'Select from Services'}</Text></View>
      <Text style={styles.label}>NAME</Text><TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#7180a2" maxLength={100} style={styles.input} />
      <Text style={styles.label}>PHONE / MOBILE</Text><View style={styles.phoneWrap}><Text style={styles.code}>+91</Text><TextInput value={phone} onChangeText={v => setPhone(v.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" placeholderTextColor="#7180a2" keyboardType="phone-pad" maxLength={10} style={styles.phoneInput} /></View>
      <Text style={styles.label}>EMAIL</Text><TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#7180a2" keyboardType="email-address" autoCapitalize="none" maxLength={160} style={styles.input} />
      <Text style={styles.label}>REQUIREMENT</Text><TextInput value={requirement} onChangeText={setRequirement} placeholder="Briefly tell me what you need." placeholderTextColor="#7180a2" multiline maxLength={400} style={[styles.input, styles.multiline]} />
      <Pressable style={styles.button} onPress={submit}><Text style={styles.buttonText}>SUBMIT ENQUIRY SECURELY →</Text></Pressable>
      <Text style={styles.note}>Your enquiry will be securely saved when the production backend is connected.</Text>
    </View>
  </Screen>
}

const styles = StyleSheet.create({
  card:{backgroundColor:'#111633',borderColor:'#2a3560',borderWidth:1,borderRadius:18,padding:16}, label:{color:'#7f8fb5',fontSize:8.5,fontWeight:'900',letterSpacing:1.2,marginBottom:5,marginTop:2}, input:{color:'#f8fafc',backgroundColor:'#0a0d25',borderColor:'#292d55',borderWidth:1,borderRadius:12,paddingHorizontal:13,paddingVertical:12,marginBottom:10}, selectLike:{backgroundColor:'#0a0d25',borderColor:'#292d55',borderWidth:1,borderRadius:12,paddingHorizontal:13,paddingVertical:13,marginBottom:10}, selectText:{color:'#cbd5e1',fontSize:13}, phoneWrap:{flexDirection:'row',alignItems:'center',backgroundColor:'#0a0d25',borderColor:'#292d55',borderWidth:1,borderRadius:12,marginBottom:10}, code:{color:'#dbeafe',fontWeight:'900',paddingLeft:13,paddingRight:8,borderRightWidth:1,borderRightColor:'#292d55'}, phoneInput:{flex:1,color:'#f8fafc',paddingVertical:12,paddingHorizontal:10}, multiline:{minHeight:100,textAlignVertical:'top'}, button:{backgroundColor:'#67e8f9',borderRadius:12,paddingVertical:13,alignItems:'center',marginTop:2}, buttonText:{color:'#07111f',fontWeight:'900',letterSpacing:.4}, note:{color:'#7180a2',fontSize:9.5,lineHeight:14,marginTop:9}
})
