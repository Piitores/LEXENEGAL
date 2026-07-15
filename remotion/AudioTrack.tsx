import React from 'react';
import { Audio, Sequence, interpolate, staticFile } from 'remotion';
import { SCENE_STARTS, TOTAL_DURATION } from './theme';

// Piste sonore : voix off française (ElevenLabs, un segment par scène) +
// lit musical rythmé en boucle + whoosh à chaque coupe.
const VO: Array<[keyof typeof SCENE_STARTS, string, number]> = [
  ['intro', 's0.mp3', 6],
  ['search', 's1.mp3', 8],
  ['codes', 's2.mp3', 8],
  ['compare', 's3.mp3', 8],
  ['jurisprudence', 's4.mp3', 8],
  ['graph', 's5.mp3', 8],
  ['cabinet', 's6b.mp3', 8],
  ['pdf', 's7.mp3', 8],
  ['mcp', 's8.mp3', 10],
  ['outro', 's9.mp3', 10],
];

const AudioTrack: React.FC = () => (
  <>
    {VO.map(([scene, file, offset]) => (
      <Sequence key={file} from={SCENE_STARTS[scene] + offset}>
        <Audio src={staticFile(`promo-audio/${file}`)} />
      </Sequence>
    ))}

    {/* Clic de souris sur chaque coupe (toutes les scènes sauf l'intro). */}
    {VO.slice(1).map(([scene]) => (
      <Sequence key={`clic-${scene}`} from={SCENE_STARTS[scene] - 2}>
        <Audio src={staticFile('promo-audio/click.mp3')} volume={0.55} />
      </Sequence>
    ))}

    <Audio
      src={staticFile('promo-audio/ambience.mp3')}
      loop
      volume={(f) =>
        interpolate(
          f,
          [0, 40, TOTAL_DURATION - 70, TOTAL_DURATION - 15],
          [0, 0.16, 0.16, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )
      }
    />
  </>
);

export default AudioTrack;
