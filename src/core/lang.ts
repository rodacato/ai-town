/** "a" + place with Spanish contraction: "a la plaza", "al puente". */
export const toPlace = (label: string) => (label.startsWith('el ') ? `al ${label.slice(3)}` : `a ${label}`)

export const firstName = (name: string) => name.split(' ')[0]

export const listNames = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : (names[0] ?? '')
