'use client';

type Scenario = 'pet' | 'baby' | 'elderly';

interface ProfileSelectorProps {
  selected: Scenario | null;
  onSelect: (scenario: Scenario) => void;
}

const PROFILES: {
  id: Scenario;
  icon: string;
  title: string;
  description: string;
  features: string[];
  color: string;
}[] = [
  {
    id: 'pet',
    icon: '🐾',
    title: 'Pet Monitoring',
    description: 'Watch over your furry friends while you\'re away',
    features: [
      'Activity detection',
      'Eating/drinking monitoring',
      'Distress detection',
      'Inactivity alerts',
    ],
    color: 'safeos',
  },
  {
    id: 'baby',
    icon: '👶',
    title: 'Baby Monitor',
    description: 'Supplement your supervision with AI monitoring',
    features: [
      'Crying detection',
      'Position monitoring',
      'Sleep safety alerts',
      'Motion tracking',
    ],
    color: 'blue',
  },
  {
    id: 'elderly',
    icon: '👴',
    title: 'Elderly Care',
    description: 'Additional monitoring for loved ones',
    features: [
      'Fall detection',
      'Inactivity alerts',
      'Distress detection',
      'Routine monitoring',
    ],
    color: 'purple',
  },
];

export default function ProfileSelector({
  selected,
  onSelect,
}: ProfileSelectorProps) {
  return (
    <div className="grid gap-4">
      {PROFILES.map((profile) => {
        const isSelected = selected === profile.id;
        const colorClasses = {
          safeos: 'border-safeos-500 bg-safeos-500/10',
          blue: 'border-blue-500 bg-blue-500/10',
          purple: 'border-purple-500 bg-purple-500/10',
        };
        const hoverClasses = {
          safeos: 'hover:border-safeos-500/50',
          blue: 'hover:border-blue-500/50',
          purple: 'hover:border-purple-500/50',
        };

        return (
          <button
            key={profile.id}
            onClick={() => onSelect(profile.id)}
            className={`profile-card text-left ${
              isSelected
                ? colorClasses[profile.color as keyof typeof colorClasses]
                : hoverClasses[profile.color as keyof typeof hoverClasses]
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">{profile.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">
                    {profile.title}
                  </h3>
                  {isSelected && (
                    <span className="text-xs bg-safeos-500 text-white px-2 py-0.5 rounded-full">
                      Selected
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/60 mt-1">{profile.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {profile.features.map((feature) => (
                    <span
                      key={feature}
                      className="text-xs bg-white/10 text-white/70 px-2 py-1 rounded"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

