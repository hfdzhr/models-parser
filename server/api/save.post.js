// Di Vercel, write ke file lokal tidak bisa — user harus Copy atau Download
export default defineEventHandler((_event) => {
  throw createError({
    statusCode: 400,
    statusMessage:
      'Cloud deployment detected: Direct save to local files is disabled on Vercel. Please use Copy or Download instead.'
  })
})
