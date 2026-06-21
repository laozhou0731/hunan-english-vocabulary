import { createRouter, createWebHistory } from 'vue-router';
import DailyPlanView from './views/DailyPlanView.vue';
import LibraryView from './views/LibraryView.vue';
import StatsView from './views/StatsView.vue';
import WrongWordsView from './views/WrongWordsView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/daily' },
    { path: '/daily', component: DailyPlanView },
    { path: '/library', component: LibraryView },
    { path: '/stats', component: StatsView },
    { path: '/wrong-words', component: WrongWordsView }
  ]
});
