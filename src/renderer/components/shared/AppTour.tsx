import React, { useState, useEffect, useRef } from 'react';
import { useUIStore, Panel } from '../../store/ui';

interface TourStep {
  title: string;
  description: string;
  targetSelector?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  panel?: Panel;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to OdooGit',
    description: 'A Git client customized specifically for Odoo developers. This walkthrough will guide you through the primary features.',
    position: 'center',
    panel: 'branches',
  },
  {
    title: 'Multi-Repository Switcher',
    description: 'Toggle between Odoo Community, Enterprise, and custom project repositories in real-time. You can open local repositories or clone new ones directly from the top rail.',
    targetSelector: '.tour-repo-rail',
    position: 'bottom',
    panel: 'branches',
  },
  {
    title: 'Git Workspace Navigation',
    description: 'Access essential Git operations here. You can view branches, stage modifications, review diffs, compose commits, stash changes, and manage remote branches.',
    targetSelector: '.tour-nav-sidebar',
    position: 'right',
    panel: 'branches',
  },
  {
    title: 'Odoo Control Center Link',
    description: 'Access the dedicated Odoo panel to run servers, configure ports, manage virtual environments, and perform database tasks.',
    targetSelector: '.tour-odoo-db',
    position: 'left',
    panel: 'branches',
  },
  {
    title: 'Launch Odoo Servers',
    description: 'Start, stop, or restart Odoo servers. View real-time terminal output, run module upgrades, and execute unit tests from this control panel.',
    targetSelector: '.tour-odoo-run-btn',
    position: 'bottom',
    panel: 'odoo',
  },
  {
    title: 'Database Management',
    description: 'Select active databases, create new ones from templates, clone databases for testing, and drop registries without passwords.',
    targetSelector: '.tour-odoo-db-field',
    position: 'bottom',
    panel: 'odoo',
  },
  {
    title: 'Python Environments',
    description: 'Configure and select different Python virtual environments (venv) to run multiple Odoo versions with their respective dependency trees.',
    targetSelector: '.tour-odoo-venv',
    position: 'bottom',
    panel: 'odoo',
  },
  {
    title: 'Settings & Authentication',
    description: 'Configure developer trigrams, default version branches, GitHub access tokens (PAT) for private repo cloning, and local PostgreSQL connection details.',
    targetSelector: '.tour-settings',
    position: 'left',
    panel: 'settings',
  },
  {
    title: 'Walkthrough Complete',
    description: 'You are ready to use OdooGit. You can restart this tour at any time from this Settings page.',
    position: 'center',
    panel: 'settings',
  },
];

interface AppTourProps {
  onClose: () => void;
}

export function AppTour({ onClose }: AppTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardStyle, setCardStyle] = useState<React.CSSProperties>({});

  const step = TOUR_STEPS[currentStep];

  // Apply page transitions programmatically during the tour
  useEffect(() => {
    if (step.panel) {
      useUIStore.getState().setActivePanel(step.panel);
    }
  }, [currentStep, step.panel]);

  // Update spotlight bounding rect when step or window changes
  useEffect(() => {
    const updatePosition = () => {
      let cardWidth = cardRef.current?.getBoundingClientRect().width || 320;
      let cardHeight = cardRef.current?.getBoundingClientRect().height || 175;
      if (cardWidth === 0) cardWidth = 320;
      if (cardHeight === 0) cardHeight = 175;

      if (!step.targetSelector) {
        setSpotlightRect(null);
        setCardStyle({
          position: 'fixed',
          top: `${window.innerHeight / 2 - cardHeight / 2}px`,
          left: `${window.innerWidth / 2 - cardWidth / 2}px`,
          zIndex: 10001,
        });
        return;
      }

      const target = document.querySelector(step.targetSelector);
      if (target) {
        // Scroll target into view if needed
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const rect = target.getBoundingClientRect();
        setSpotlightRect(rect);

        // Position the card relative to the target
        const offset = 12;
        let top = 0;
        let left = 0;

        if (step.position === 'bottom') {
          top = rect.bottom + offset;
          left = rect.left + rect.width / 2 - cardWidth / 2;
        } else if (step.position === 'top') {
          top = rect.top - offset - cardHeight;
          left = rect.left + rect.width / 2 - cardWidth / 2;
        } else if (step.position === 'right') {
          top = rect.top + rect.height / 2 - cardHeight / 2;
          left = rect.right + offset;
        } else if (step.position === 'left') {
          top = rect.top + rect.height / 2 - cardHeight / 2;
          left = rect.left - offset - cardWidth;
        }

        // Screen boundary safety checks (ensuring TitleBar height of 40px is respected)
        const titleBarHeight = 40;
        const margin = 12;

        if (left < margin) {
          left = margin;
        } else if (left + cardWidth > window.innerWidth - margin) {
          left = window.innerWidth - cardWidth - margin;
        }

        if (top < titleBarHeight + 6) {
          top = titleBarHeight + 6;
        } else if (top + cardHeight > window.innerHeight - margin) {
          top = window.innerHeight - cardHeight - margin;
        }

        setCardStyle({
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          zIndex: 10001,
        });
      } else {
        // Fallback to center if element not found
        setSpotlightRect(null);
        setCardStyle({
          position: 'fixed',
          top: `${window.innerHeight / 2 - cardHeight / 2}px`,
          left: `${window.innerWidth / 2 - cardWidth / 2}px`,
          zIndex: 10001,
        });
      }
    };

    // Delay slightly to allow DOM switches or mounts to finish loading
    const timer = setTimeout(updatePosition, 200);
    window.addEventListener('resize', updatePosition);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
    };
  }, [currentStep, step]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    localStorage.setItem('odoogit_hasSeenTour', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] overflow-hidden pointer-events-none select-none">
      {/* Darkened overlay with SVG mask for spotlight */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" style={{ zIndex: 10000 }}>
        <defs>
          <mask id="spotlight-mask">
            {/* White color draws the mask (fully opaque) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black color subtracts from mask (spotlight hole) */}
            {spotlightRect && (
              <rect
                x={spotlightRect.left - 4}
                y={spotlightRect.top - 4}
                width={spotlightRect.width + 8}
                height={spotlightRect.height + 8}
                rx="6"
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* The overlay layer itself */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(5, 5, 10, 0.7)"
          mask="url(#spotlight-mask)"
          className="transition-all duration-300"
        />
      </svg>

      {/* Subtle spotlight outline (no glowing shadow or pulse) */}
      {spotlightRect && (
        <div
          className="fixed pointer-events-none transition-all duration-200 border border-accent/70 rounded-md"
          style={{
            top: spotlightRect.top - 5,
            left: spotlightRect.left - 5,
            width: spotlightRect.width + 10,
            height: spotlightRect.height + 10,
            zIndex: 10001,
          }}
        />
      )}

      {/* Tour Step Card */}
      <div
        ref={cardRef}
        style={cardStyle}
        className="w-[320px] bg-[#161B22] border border-border rounded-lg shadow-2xl p-5 pointer-events-auto flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Step Indicator & Skip Button */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-accent/90">
            Step {currentStep + 1} of {TOUR_STEPS.length}
          </span>
          {currentStep < TOUR_STEPS.length - 1 && (
            <button
              onClick={handleFinish}
              className="text-[11px] text-muted hover:text-primary transition-colors font-medium cursor-pointer"
            >
              Skip
            </button>
          )}
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5">
          <h4 className="text-[14px] font-bold text-white tracking-wide">{step.title}</h4>
          <p className="text-[12px] text-muted leading-relaxed select-text">{step.description}</p>
        </div>

        {/* Progress Dots */}
        <div className="flex items-center gap-1.5 mt-0.5">
          {TOUR_STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx === currentStep ? 'w-3 bg-accent' : 'w-1 bg-border'
              }`}
            />
          ))}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border/30 pt-3 mt-0.5">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="px-3 py-1.5 border border-border hover:bg-border/30 rounded text-[11px] text-primary transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="px-4 py-1.5 bg-accent hover:bg-accent/80 text-white rounded text-[11px] font-semibold transition-all cursor-pointer"
          >
            {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
