import React from 'react'
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native'
import { ArrowDownLeft, ArrowUpRight, Bell, Wallet } from 'lucide-react-native'

const transactions = [
  { title: 'Transfer received', meta: 'NayaPay · Today, 10:42 AM', amount: '+ Rs. 18,500', incoming: true },
  { title: 'Grocery store', meta: 'Easypaisa · Today, 09:18 AM', amount: '− Rs. 4,250', incoming: false },
  { title: 'Mobile package', meta: 'NayaPay · Yesterday', amount: '− Rs. 1,200', incoming: false }
]

export default function App() {
  return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" backgroundColor="#f6f8fa" />
    <ScrollView contentContainerStyle={s.page}>
      <View style={s.header}>
        <View style={s.brand}><View style={s.logo}><Wallet color="#167a5a" size={20}/></View><View><Text style={s.brandTitle}>my finance</Text><Text style={s.kicker}>PERSONAL MONEY</Text></View></View>
        <Bell color="#667487" size={21}/>
      </View>
      <Text style={s.eyebrow}>TUESDAY, NOVEMBER 03, 2026</Text>
      <Text style={s.title}>Good evening.</Text>
      <Text style={s.subtitle}>Here’s what’s happening with your money.</Text>
      <View style={s.balance}>
        <Text style={s.mutedLight}>Total wallet balance · demo preview</Text>
        <Text style={s.balanceValue}>Rs. 42,850</Text>
        <Text style={s.balanceFoot}>2 wallets · illustrative values only</Text>
      </View>
      <View style={s.stats}>
        <View style={s.stat}><Text style={s.statLabel}>Received</Text><Text style={s.statValue}>Rs. 30,500</Text></View>
        <View style={s.stat}><Text style={s.statLabel}>Spent</Text><Text style={s.statValue}>Rs. 18,250</Text></View>
      </View>
      <Text style={s.section}>Your wallets</Text>
      <View style={s.wallet}><View><Text style={s.walletName}>NayaPay</Text><Text style={s.walletMeta}>Connection pending</Text></View><Text style={s.walletDemo}>DEMO</Text></View>
      <View style={s.wallet}><View><Text style={s.walletName}>easypaisa</Text><Text style={s.walletMeta}>Connection pending</Text></View><Text style={s.walletDemo}>DEMO</Text></View>
      <Text style={s.section}>Recent transactions</Text>
      {transactions.map((t,i)=><View key={i} style={s.tx}>
        <View style={[s.txIcon,{backgroundColor:t.incoming?'#eaf7f1':'#fff4e9'}]}>{t.incoming?<ArrowDownLeft color="#269d79" size={18}/>:<ArrowUpRight color="#d49a55" size={18}/>}</View>
        <View style={s.txInfo}><Text style={s.txTitle}>{t.title}</Text><Text style={s.txMeta}>{t.meta}</Text></View>
        <Text style={[s.txAmount,{color:t.incoming?'#269d79':'#39495a'}]}>{t.amount}</Text>
      </View>)}
      <Text style={s.disclaimer}>Wallet connections are pending official API approval. Preview amounts are not live financial data.</Text>
    </ScrollView>
  </SafeAreaView>
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#f6f8fa'},page:{padding:22,paddingBottom:40},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:34},
 brand:{flexDirection:'row',alignItems:'center',gap:10},logo:{width:36,height:36,borderRadius:12,backgroundColor:'#d9f4e9',alignItems:'center',justifyContent:'center'},
 brandTitle:{fontSize:17,fontWeight:'800',color:'#172334'},kicker:{fontSize:8,letterSpacing:1.5,color:'#8292a5'},
 eyebrow:{fontSize:9,letterSpacing:1.3,fontWeight:'700',color:'#9aa4af'},title:{fontSize:28,fontWeight:'800',color:'#172536',marginTop:8},subtitle:{fontSize:12,color:'#8b96a3',marginTop:3,marginBottom:22},
 balance:{backgroundColor:'#145c4d',borderRadius:16,padding:20},mutedLight:{fontSize:11,color:'#c0ddd2'},balanceValue:{fontSize:30,fontWeight:'800',color:'#fff',marginTop:10},balanceFoot:{fontSize:10,color:'#b5d6c9',marginTop:8},
 stats:{flexDirection:'row',gap:12,marginTop:13},stat:{flex:1,backgroundColor:'#fff',borderRadius:13,padding:15,borderWidth:1,borderColor:'#edf0f3'},statLabel:{fontSize:10,color:'#87929f'},statValue:{fontSize:16,fontWeight:'800',color:'#203044',marginTop:9},
 section:{fontSize:15,fontWeight:'800',color:'#263648',marginTop:27,marginBottom:12},wallet:{backgroundColor:'#fff',borderRadius:12,padding:16,marginBottom:9,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderColor:'#edf0f3'},walletName:{fontSize:13,fontWeight:'700',color:'#263648'},walletMeta:{fontSize:10,color:'#9aa4af',marginTop:4},walletDemo:{fontSize:9,fontWeight:'800',color:'#b27c3c',letterSpacing:1},
 tx:{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:13,borderBottomWidth:1,borderBottomColor:'#edf0f3'},txIcon:{width:34,height:34,borderRadius:10,alignItems:'center',justifyContent:'center'},txInfo:{flex:1},txTitle:{fontSize:11,fontWeight:'700',color:'#344456'},txMeta:{fontSize:9,color:'#9aa4af',marginTop:4},txAmount:{fontSize:10,fontWeight:'800'},disclaimer:{fontSize:10,lineHeight:16,color:'#9aa4af',marginTop:22}
})