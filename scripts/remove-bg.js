// Robust background remover for near-black backgrounds using sharp raw pixel operations.
// Usage: node scripts/remove-bg.js [threshold]
// Place source image at public/logo-source.png. Result will be written to public/logo.png

const sharp = require('sharp')
const fs = require('fs')

const input = 'public/logo-source.png'
const output = 'public/logo.png'
const threshold = parseInt(process.argv[2] || '30', 10) // 0-255

if(!fs.existsSync(input)){
  console.error('Input file not found:', input)
  process.exit(1)
}

;(async ()=>{
  try{
    const img = sharp(input).ensureAlpha()
    const { width, height } = await img.metadata()
    const raw = await img.raw().toBuffer()

    // raw is RGBA per pixel
    for(let i=0;i<raw.length;i+=4){
      const r = raw[i]
      const g = raw[i+1]
      const b = raw[i+2]
      // if pixel is near-black (all channels below threshold), make alpha 0
      if(r <= threshold && g <= threshold && b <= threshold){
        raw[i+3] = 0
      }
    }

    await sharp(raw, { raw: { width, height, channels: 4 } }).png().toFile(output)
    console.log('Saved transparent logo to', output)
  }catch(err){
    console.error('Processing failed:', err)
    process.exit(1)
  }
})()
