import React, { useEffect, useState } from 'react'
import { AbsoluteFill, Audio, Composition, continueRender, delayRender, staticFile } from 'remotion'
import { TransitionSeries, linearTiming, springTiming, type TransitionPresentation, type TransitionPresentationComponentProps } from '@remotion/transitions'
import { slide } from '@remotion/transitions/slide'
import { wipe } from '@remotion/transitions/wipe'
import { flip } from '@remotion/transitions/flip'
import { clockWipe } from '@remotion/transitions/clock-wipe'
import T from './timeline.json'
import { Assistant, Bag, Dex, Ds, Editor, Games, Hook, Outro, Share, Team, Upload } from './scenes'
import { H, W } from './kit'

const SCENES: Record<string, React.FC<{ dur: number }>> = { hook: Hook, games: Games, upload: Upload, team: Team, editor: Editor, bag: Bag, dex: Dex, assistant: Assistant, share: Share, ds: Ds, outro: Outro }
export const TOTAL = T.scenes.reduce((s, x) => s + x.beats * T.beat, 0) - (T.scenes.length - 1) * T.transition

// Transición propia: "atravesar" la escena (la de salida crece y se desenfoca, la nueva llega de lejos).
function ZoomThrough({ children, presentationDirection, presentationProgress }: TransitionPresentationComponentProps<Record<string, never>>) {
  const p = presentationProgress
  const entering = presentationDirection === 'entering'
  const scale = entering ? 0.4 + 0.6 * p : 1 + 2.5 * p
  const blur = entering ? (1 - p) * 20 : p * 30
  return <AbsoluteFill style={{ transform: `scale(${scale}) rotate(${entering ? (1 - p) * -12 : p * 10}deg)`, filter: `blur(${blur}px)`, opacity: entering ? p : 1 - p }}>{children}</AbsoluteFill>
}
const zoomThrough = (): TransitionPresentation<Record<string, never>> => ({ component: ZoomThrough, props: {} })

const fast = (d: number) => springTiming({ config: { damping: 200 }, durationInFrames: d })
const TRANSITIONS = [
  { presentation: zoomThrough(), timing: linearTiming({ durationInFrames: T.transition }) },
  { presentation: slide({ direction: 'from-bottom' }), timing: fast(T.transition) },
  { presentation: wipe({ direction: 'from-top-left' }), timing: fast(T.transition) },
  { presentation: zoomThrough(), timing: linearTiming({ durationInFrames: T.transition }) },
  { presentation: slide({ direction: 'from-right' }), timing: fast(T.transition) },
  { presentation: flip({ direction: 'from-left' }), timing: fast(T.transition) },
  { presentation: clockWipe({ width: W, height: H }), timing: linearTiming({ durationInFrames: T.transition }) },
  { presentation: slide({ direction: 'from-left' }), timing: fast(T.transition) },
  { presentation: wipe({ direction: 'from-bottom-right' }), timing: fast(T.transition) },
  { presentation: zoomThrough(), timing: linearTiming({ durationInFrames: T.transition }) },
]

function Video() {
  const [handle] = useState(() => delayRender('fuentes'))
  useEffect(() => {
    Promise.all([
      new FontFace('PX', `url(${staticFile('fonts/px.woff2')})`).load(),
      new FontFace('FR', `url(${staticFile('fonts/fredoka.woff2')})`, { weight: '300 700' }).load(),
    ]).then((faces) => {
      faces.forEach((f) => document.fonts.add(f))
      continueRender(handle)
    })
  }, [handle])
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <TransitionSeries>
        {T.scenes.flatMap((s, i) => {
          const Scene = SCENES[s.id]
          const dur = s.beats * T.beat
          const seq = (
            <TransitionSeries.Sequence key={s.id} durationInFrames={dur}>
              <Scene dur={dur} />
            </TransitionSeries.Sequence>
          )
          if (i === T.scenes.length - 1) return [seq]
          const tr = TRANSITIONS[i % TRANSITIONS.length]
          return [seq, <TransitionSeries.Transition key={s.id + '-t'} presentation={tr.presentation as TransitionPresentation<Record<string, unknown>>} timing={tr.timing} />]
        })}
      </TransitionSeries>
      <Audio src={staticFile('music.wav')} />
    </AbsoluteFill>
  )
}

export function Root() {
  return <Composition id="PokeSave" component={Video} durationInFrames={TOTAL} fps={T.fps} width={W} height={H} />
}
