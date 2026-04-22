function Error({ statusCode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 text-center" dir="rtl">
      <div className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-2xl font-black text-slate-900 mb-4">
          {statusCode
            ? `حدث خطأ ${statusCode} على الخادم`
            : 'حدث خطأ في المتصفح'}
        </h1>
        <p className="text-slate-500 font-bold mb-8">عذراً، حدث خلل تقني غير متوقع. يرجى المحاولة مرة أخرى أو العودة للرئيسية.</p>
        <button 
          onClick={() => window.location.href = '/'}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-black transition-all"
        >العودة للرئيسية</button>
      </div>
    </div>
  )
}

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error