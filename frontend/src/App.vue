<template>
  <div class="layout">
    <header class="topbar">
      <div class="brand">
        <p class="small">HUNAN ENGLISH</p>
        <h2>英语学习打开</h2>
      </div>
      <nav>
        <RouterLink to="/daily" class="link" active-class="active">每日计划</RouterLink>
        <RouterLink to="/library" class="link" active-class="active">完整词库</RouterLink>
        <RouterLink to="/wrong-words" class="link" active-class="active">错词本</RouterLink>
        <RouterLink to="/stats" class="link" active-class="active">进度统计</RouterLink>
        <RouterLink to="/reports" class="link" active-class="active">学习报告</RouterLink>
      </nav>
    </header>

    <section class="content glass">
      <RouterView />
    </section>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.topbar {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding: 8px 6px;
  flex-wrap: wrap;
}

.small {
  margin: 0;
  letter-spacing: 0.18em;
  font-size: 11px;
  color: #6d747d;
}

.brand h2 {
  margin: 4px 0 0;
  font-size: 30px;
  color: #0f1113;
  letter-spacing: -0.02em;
}

nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
}

.link {
  color: #4f5862;
  text-decoration: none;
  padding: 9px 14px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.64);
  transition: all 0.25s ease;
}

.link:hover,
.active {
  color: #ffffff;
  background: #0071e3;
  border-color: #0071e3;
}

.glass {
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 30px;
  box-shadow: 0 26px 60px rgba(15, 20, 28, 0.12);
  backdrop-filter: blur(18px);
}

.content {
  padding: 24px;
}

@media (max-width: 900px) {
  .layout {
    padding: 14px;
  }

  .topbar {
    flex-direction: column;
    align-items: flex-start;
    margin-bottom: 12px;
    gap: 10px;
  }

  .brand h2 {
    font-size: 24px;
  }

  nav {
    width: 100%;
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 2px;
    margin-left: 0;
  }

  .link {
    white-space: nowrap;
    padding: 8px 12px;
    font-size: 14px;
  }
}

@media (max-width: 680px) {
  .layout {
    padding: 10px;
  }

  .content {
    padding: 14px;
    border-radius: 22px;
  }
}
</style>
