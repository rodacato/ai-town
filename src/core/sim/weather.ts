export type Weather = 'clear' | 'rain' | 'storm' | 'snow' | 'fog'

export const WEATHERS: Weather[] = ['clear', 'rain', 'storm', 'snow', 'fog']

/** How the sky reads to people and to a model deciding for a resident. */
export const WEATHER_TEXT: Record<Weather, { label: string; sentence: string }> = {
  clear: { label: 'Despejado', sentence: 'Hace buen tiempo.' },
  rain: { label: 'Lluvia', sentence: 'Está lloviendo.' },
  storm: { label: 'Tormenta', sentence: 'Hay tormenta, con truenos y relámpagos.' },
  snow: { label: 'Nieve', sentence: 'Está nevando y hace mucho frío.' },
  fog: { label: 'Niebla', sentence: 'Hay una niebla tan espesa que apenas se ve.' },
}

/** Weather that keeps most people indoors. */
export const isFoul = (w: Weather) => w === 'rain' || w === 'storm' || w === 'snow'
