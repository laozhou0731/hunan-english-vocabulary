<script setup lang="ts">
defineProps<{
  title: string;
  value: string | number;
  subtitle?: string;
}>();
</script>

<template>
  <div class="kpi-card">
    <p class="kpi-title">{{ title }}</p>
    <p class="kpi-value">{{ value }}</p>
    <p v-if="subtitle" class="kpi-subtitle">{{ subtitle }}</p>
  </div>
</template>

<style scoped>
.kpi-card {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 20px;
  padding: 16px;
  box-shadow: 0 12px 30px rgba(15, 20, 28, 0.08);
  backdrop-filter: blur(10px);
}

.kpi-title {
  margin: 0;
  color: #63707c;
  font-size: 13px;
  letter-spacing: 0.04em;
}

.kpi-value {
  margin: 10px 0 6px;
  font-size: 32px;
  font-weight: 700;
  color: #111418;
  line-height: 1;
}

.kpi-subtitle {
  margin: 0;
  color: #72808d;
  font-size: 13px;
}
</style>
