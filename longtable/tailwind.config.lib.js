/** @type {import('tailwindcss').Config} */
export default {
    corePlugins: {
        preflight: false,
    },
    important: '.longtable-scope',
    darkMode: 'class',
    content: [
        "./longtable/**/*.{html,ts}"
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}
