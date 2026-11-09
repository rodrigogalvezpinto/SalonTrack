/**
 * Formateadores regionales para Chile (CLP, Fechas DD/MM/AAAA, Teléfonos +56 9)
 */

// Formateo de Peso Chileno (Entero, sin decimales, separador de miles con punto)
export function formatCLP(amount: number | string | undefined | null): string {
  const num = typeof amount === 'string' ? parseInt(amount, 10) : amount;
  if (num === undefined || num === null || isNaN(num)) {
    return '$0';
  }
  // Formato chileno: $45.000
  return '$' + Math.round(num).toLocaleString('es-CL');
}

// Formateo de fecha DD/MM/AAAA
export function formatChileanDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '--/--/----';
  // If format is YYYY-MM-DD
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Formateo de teléfono chileno (+56 9 1234 5678)
export function formatChileanPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('569') && digits.length === 11) {
    return `+56 9 ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  if (digits.startsWith('9') && digits.length === 9) {
    return `+56 9 ${digits.slice(1, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

// Limpieza para URL de WhatsApp (e.g. 56912345678)
export function getCleanWhatsAppPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('9') && cleaned.length === 9) {
    cleaned = '56' + cleaned;
  }
  return cleaned;
}

// Construye URL directa de WhatsApp
export function buildWhatsAppLink(phone: string, text: string): string {
  const cleanPhone = getCleanWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

// Genera el mensaje personalizado para la clienta
export function prepareWhatsAppMessage(
  template: string,
  data: {
    clientName: string;
    salonName: string;
    stylistName?: string;
    serviceType?: string;
    nextRetouchDate?: string;
  }
): string {
  let msg = template || '¡Hola {nombre}! Te saluda {salon} ✨ Te escribo porque ya se aproxima la fecha de tu retoque de {servicio}. ¿Coordinamos tu hora? 💇‍♀️';
  
  msg = msg.replace(/{nombre}/g, data.clientName || 'estimada clienta');
  msg = msg.replace(/{salon}/g, data.salonName || 'nuestro salón');
  msg = msg.replace(/{estilista}/g, data.stylistName || 'tu estilista');
  msg = msg.replace(/{servicio}/g, data.serviceType || 'retoque de color');
  msg = msg.replace(/{fecha}/g, data.nextRetouchDate ? formatChileanDate(data.nextRetouchDate) : 'próximos días');

  return msg;
}
