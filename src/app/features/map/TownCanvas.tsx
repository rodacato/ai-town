import { useEffect, useRef } from 'react'
import { town } from '../../town'
import './map.css'

export function TownCanvas() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => town.mount(host.current!), [])
  return <div ref={host} className="town-canvas" />
}
