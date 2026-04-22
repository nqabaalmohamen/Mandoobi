import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '../services/auth'
import { getData } from '../services/db'

const services = [
  /*
  { 
    id: '1', 
    title: 'طلبات المطاعم والكافيهات', 
    icon: '🍔',
    description: 'نوفر خدمة دليفري سريعة لجميع مطاعمك المفضلة والكافيهات. نضمن لك وصول الطعام ساخناً وبحالة ممتازة في أسرع وقت ممكن، مع عناية فائقة في التعامل مع الوجبات والمشروبات.'
  },
  { 
    id: '2', 
    title: 'السوبر ماركت والبقالة', 
    icon: '🛒',
    description: 'نشتري لك مستلزمات المنزل اليومية من السوبر ماركت، الخضروات، والفاكهة. مندوبنا يقوم باختيار أفضل المنتجات بعناية وتوصيلها حتى باب منزلك دون عناء.'
  },
  */
  {
    id: '3',
    title: 'توصيل بين الأفراد (من باب لباب)',
    icon: '🤝',
    description: 'خدمة مخصصة لنقل الأغراض بين الأفراد. هل نسيت مفاتيحك؟ هل تريد إرسال غرض لصديق أو قريب؟ نحن نستلم منك ونسلم للطرف الآخر في أي مكان داخل المدينة بكل سهولة وأمان.'
  },
  /*
  { 
    id: '4', 
    title: 'الصيدليات والمستلزمات الطبية', 
    icon: '💊',
    description: 'خدمة توصيل الأدوية والمستلزمات الطبية من الصيدليات على مدار الساعة. ندرك أهمية الوقت في هذه الخدمة، لذا نوليها أولوية قصوى لضمان وصول الدواء إليك في أسرع وقت.'
  },
  { 
    id: '5', 
    title: 'توصيل مستندات وأغراض خفيفة', 
    icon: '📩',
    description: 'استلام وتسليم الأوراق الرسمية، الطرود الورقية، أو أي مقتنيات شخصية بسيطة للأفراد أو الشركات بخصوصية تامة وسرعة فائقة.'
  },
  */
]

import { db } from '../services/firebase'

export default function Home() {
  const { user } = useAuth() || {}
  return (
    <div className="bg-white" dir="rtl">
      {!db && (
        <div className="bg-blue-600 text-white text-center py-2 px-4 text-xs sm:text-sm font-bold relative z-[200]">
          ⚠️ الموقع يعمل حالياً في "وضع التجربة". البيانات تُحفظ في متصفحك فقط ولن تظهر على الأجهزة الأخرى حتى يتم ربط Firebase.
        </div>
      )}
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-16 sm:pt-16 sm:pb-32">
        <div className="max-w-[100%] mx-auto px-4 sm:px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="relative z-10 text-center lg:text-right">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 text-[#FF6A00] rounded-full text-[10px] sm:text-xs font-black mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF6A00]"></span>
              </span>
              منصة التوصيل رقم #1 في الفيوم
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-slate-900 leading-[1.2] lg:leading-[1.1] mb-6">
              توصيل سريع <br className="hidden sm:block" />
              بكل ثقة وأمان
            </h1>
            <p className="text-base sm:text-lg text-slate-500 font-medium leading-relaxed mb-10 max-w-lg mx-auto lg:mx-0">
              Mandoobi <span className="text-[#FF6A00] font-black">مندو بي</span> هي منصة التوصيل الأسرع والأكثر موثوقية. اطلب ما تريد، في أي وقت، وسنصل إليك أينما كنت في دقائق.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href={user ? "/order/create" : "/login"} className="px-8 sm:px-10 py-4 sm:py-5 bg-[#FF6A00] text-white rounded-2xl font-black text-base sm:text-lg shadow-2xl shadow-[#FF6A00]/40 hover:bg-[#FF8A3D] hover:-translate-y-1 transition-all text-center">
                اطلب الآن 🚀
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-8 grayscale opacity-50">
              <div className="font-black text-slate-400 w-full sm:w-auto mb-2 sm:mb-0">شركاء النجاح:</div>
              <div className="text-lg sm:text-xl font-bold italic">FAST CO.</div>
              <div className="text-lg sm:text-xl font-bold italic">EGYPT LOGISTICS</div>
            </div>
          </div>

          <div className="relative h-[350px] sm:h-[450px] lg:h-[600px] flex items-center justify-center mt-12 lg:mt-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[400px] lg:w-[500px] h-[300px] sm:h-[400px] lg:h-[500px] bg-orange-600/10 blur-[80px] sm:blur-[120px] rounded-full"></div>
            <div className="relative bg-white p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3rem] shadow-2xl border border-slate-100 rotate-2 hover:rotate-0 transition-transform duration-700 max-w-[280px] sm:max-w-sm w-full">
              <div className="flex flex-col gap-4 sm:gap-6">
                <div className="flex items-center gap-4 p-3 sm:p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#FF6A00] rounded-xl flex items-center justify-center text-white text-lg sm:text-xl">🛵</div>
                  <div>
                    <div className="text-[12px] sm:text-sm font-black text-slate-900">مندوبك في الطريق</div>
                    <div className="text-[8px] sm:text-[10px] text-slate-400 font-bold uppercase">وصل الآن إلى منطقتك</div>
                  </div>
                </div>
                <div className="h-32 sm:h-48 bg-slate-100 rounded-[2rem] overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-transparent"></div>
                  <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 bg-white px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg shadow-lg text-[8px] sm:text-[10px] font-black text-[#FF6A00]">Live Tracking 📍</div>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  <div className="h-1.5 sm:h-2 w-3/4 bg-slate-100 rounded-full"></div>
                  <div className="h-1.5 sm:h-2 w-1/2 bg-slate-100 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-16 sm:py-32 bg-slate-50">
        <div className="max-w-[100%] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-6">
              خدماتنا <span className="text-[#FF6A00]">اللوجستية</span>
            </h2>
            <p className="text-base sm:text-lg text-slate-500 font-medium leading-relaxed px-4">
              سواء كنت فرداً يحتاج لتوصيل غرض ما، أو صاحب عمل يبحث عن دليفري موثوق، نحن هنا لخدمتك. نوفر حلول توصيل متكاملة تلبي احتياجاتك اليومية بأعلى مستويات الدقة والأمان.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-white p-10 sm:p-14 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group text-center relative overflow-hidden"
              >
                {/* Decorative element */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-[#FF6A00]"></div>

                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-orange-50 text-[#FF6A00] rounded-3xl flex items-center justify-center text-4xl sm:text-5xl mx-auto mb-8 group-hover:bg-[#FF6A00] group-hover:text-white transition-all duration-500 shadow-inner">
                  {service.icon}
                </div>

                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-6">{service.title}</h3>
                <p className="text-base sm:text-lg text-slate-500 font-medium leading-relaxed mb-10 max-w-md mx-auto">
                  {service.description}
                </p>

                <Link
                  href={user ? `/order/create?service=${service.id}` : "/login"}
                  className="inline-flex items-center gap-3 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-base hover:bg-[#FF6A00] hover:shadow-xl hover:shadow-[#FF6A00]/30 transition-all duration-300"
                >
                  اطلب هذه الخدمة الآن 🚀
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-16 sm:py-32 bg-slate-50 relative overflow-hidden">
        <div className="max-w-[100%] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
          <div className="text-center max-w-5xl mx-auto mb-12 sm:mb-20">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-4">كيف يعمل Mandoobi <span className="text-[#FF6A00]">مندو بي</span>؟</h2>
            <p className="text-sm sm:text-base text-slate-500 font-medium px-4">بخطوات بسيطة وسهلة، يمكنك الحصول على طلبك في أسرع وقت ممكن وبأقل مجهود.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12 px-2 sm:px-6 lg:px-12">
            <StepCard
              number="01"
              title="حدد تفاصيل طلبك"
              desc="اختر الخدمة المطلوبة أو اكتب تفاصيل طلبك يدوياً بكل سهولة."
              icon="📝"
            />
            <StepCard
              number="02"
              title="اختر طريقة الدفع"
              desc="نوفر لك طرق دفع متعددة، كاش أو تحويل بنكي مع رفع صورة التحويل."
              icon="💳"
            />
            <StepCard
              number="03"
              title="تتبع واستلم"
              desc="تابع حركة المندوب لحظة بلحظة حتى وصول الطلب إلى باب منزلك."
              icon="🏠"
            />
          </div>
        </div>
      </section>

      <StatsSection />

      {/* Footer */}
      <footer className="py-12 sm:py-16 bg-slate-900 text-white border-t border-slate-800">
        <div className="max-w-[100%] mx-auto px-4 sm:px-6 lg:px-12 flex flex-col md:flex-row-reverse items-center justify-between gap-10">
          
          {/* Left Side: Logo & Description */}
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Social Links next to logo */}
            <div className="flex gap-4 order-2 md:order-1">
              <a href="#" className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-[#1877F2] transition-all duration-300 group shadow-lg">
                <span className="text-xl">📘</span>
              </a>
              <a href="#" className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-[#25D366] transition-all duration-300 group shadow-lg">
                <span className="text-xl">🟢</span>
              </a>
            </div>

            <div className="flex flex-col items-center md:items-start order-1 md:order-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 relative">
                  <Image src="/Mandoobi/logo.png" alt="Mandoobi logo" layout="fill" objectFit="contain" />
                </div>
                <span className="text-xl sm:text-2xl font-black tracking-tighter">Mandoobi <span className="text-[#FF6A00]">مندو بي</span></span>
              </div>
              <p className="text-slate-400 max-w-sm leading-relaxed text-sm sm:text-base text-center md:text-right">
                المنصة الرائدة في الفيوم لخدمات التوصيل اللوجستي الذكي. نجمع بين السرعة، الأمان، والتكنولوجيا لتوفير أفضل تجربة للمستخدم.
              </p>
            </div>
          </div>

          <div className="hidden md:block">
            <Link href="/support" className="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-black transition-all border border-white/5">
              تواصل معنا 💬
            </Link>
          </div>
        </div>
        <div className="max-w-[100%] mx-auto px-4 sm:px-6 lg:px-12 mt-12 sm:mt-20 pt-8 border-t border-slate-800 text-center text-slate-500 text-[10px] sm:text-xs font-bold leading-relaxed">
          © 2026 Mandoobi <span className="text-[#FF6A00]">مندو بي</span>. جميع الحقوق محفوظة لشركة Mandoobi Logisitcs.
        </div>
      </footer>
    </div>
  )
}

function StepCard({ number, title, desc, icon }) {
  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group">
      <div className="flex justify-between items-start mb-8">
        <div className="w-16 h-16 bg-orange-50 text-[#FF6A00] rounded-2xl flex items-center justify-center text-3xl group-hover:bg-[#FF6A00] group-hover:text-white transition-colors duration-500">
          {icon}
        </div>
        <span className="text-4xl font-black text-slate-100 group-hover:text-orange-50 transition-colors duration-500">{number}</span>
      </div>
      <h3 className="text-xl font-black text-slate-900 mb-4">{title}</h3>
      <p className="text-slate-500 font-medium leading-relaxed">{desc}</p>
    </div>
  )
}

function StatItem({ label, value }) {
  return (
    <div>
      <div className="text-4xl font-black mb-2">{value}</div>
      <div className="text-orange-100 text-sm font-bold uppercase tracking-widest">{label}</div>
    </div>
  )
}

function SocialLink({ icon }) {
  return (
    <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center hover:bg-[#FF6A00] transition-colors cursor-pointer">
      {icon}
    </div>
  )
}

function StatsSection() {
  const [counts, setCounts] = useState({ orders: 0, couriers: 0, clients: 0 })

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const users = await getData('mandoobi_users')
        const orders = await getData('mandoobi_orders')

        setCounts({
          orders: Array.isArray(orders) ? orders.length : 0,
          couriers: Array.isArray(users) ? users.filter(u => u.role === 'courier').length : 0,
          clients: Array.isArray(users) ? users.filter(u => u.role === 'client').length : 0
        })
      } catch (e) {
        console.error('Failed to fetch stats:', e)
      }
    }
    fetchCounts()
    const interval = setInterval(fetchCounts, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="py-12 sm:py-20 bg-[#FF6A00] text-white">
      <div className="max-w-[100%] mx-auto px-4 sm:px-6 lg:px-12 grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10 text-center">
        <StatItem label="طلب ناجح" value={`+${3420 + counts.orders}`} />
        <StatItem label="مندوب نشط" value={`+${240 + counts.couriers}`} />
        <StatItem label="عميل سعيد" value={`+${11340 + counts.clients}`} />
      </div>
    </section>
  )
}
