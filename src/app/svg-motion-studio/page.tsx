import { Metadata } from 'next';
import SvgMotionStudio from '@/components/SvgMotionStudio/SvgMotionStudio';
import FeaturePageGate from '@/components/dashboard/FeaturePageGate';

export const metadata: Metadata = {
  title: 'MCU SVG Motion Studio | Professional SVG Animation & Keyframe Editor',
  description:
    'Browser-based SVG animation studio. Upload vector artwork, detect individual layers and elements, rig semantic character parts, and animate with visual timeline and keyframes.',
  keywords: [
    'SVG animation',
    'SVG editor',
    'keyframe animation',
    'motion graphics',
    'after effects svg',
    'vector animation',
    'lottie alternative',
    'web animation',
    'MCUSTOCK',
  ],
};

export default function SvgMotionStudioPage() {
  return (
    <main className="fixed inset-0 overflow-hidden bg-[var(--main-bg)] text-foreground" style={{ padding: 0 }}>
      <FeaturePageGate feature="SVG Motion Studio" keys={["svg_motion"]}>
        <SvgMotionStudio />
      </FeaturePageGate>
    </main>
  );
}
