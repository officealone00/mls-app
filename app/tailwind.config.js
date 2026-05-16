/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        toss: {
          blue: '#3182F6',
          'blue-dark': '#1B64DA',
          gray: {
            50: '#F9FAFB',
            100: '#F2F4F6',
            200: '#E5E8EB',
            300: '#D1D6DB',
            400: '#B0B8C1',
            500: '#8B95A1',
            600: '#6B7684',
            700: '#4E5968',
            800: '#333D4B',
            900: '#191F28',
          },
          green: '#34C759',
          red: '#FF3B30',
          orange: '#FF9500',
          yellow: '#FFCC00',
        },
        // K리그1 팀 컬러
        kleague: {
          seoul: '#000000',
          ulsan: '#1F4396',
          gangwon: '#F58220',
          jeonbuk: '#006A39',
          jeju: '#F26522',
          pohang: '#E60026',
          daejeon: '#691F74',
          daegu: '#1F66B4',
          gwangju: '#E60012',
          gimcheon: '#9E1B32',
          suwonfc: '#7E2A36',
          anyang: '#522F8B',
        },
      },
      fontFamily: {
        toss: ['Toss Product Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Pretendard', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        toss: '16px',
        'toss-sm': '12px',
      },
      boxShadow: {
        toss: '0 2px 8px rgba(0, 0, 0, 0.08)',
        'toss-lg': '0 4px 16px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
};
