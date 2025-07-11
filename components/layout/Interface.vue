<template>
  <div>
    <Hero />
    <div
      ref="interfaceContainer"
      class="pb-6 card border border-surface2 shadow-2xl backdrop-blur-sm w-full terminal-container flex flex-col rounded-lg bg-surface0/50">
      <!-- Interface header with window controls -->
      <div
        class="terminal-header flex items-center justify-start px-4 py-2 bg-surface1/95 backdrop-blur-sm border-b border-surface2 sticky top-0 z-10 rounded-t-lg">
        <div class="flex space-x-2">
          <div class="w-3 h-3 rounded-full bg-red"/>
          <div class="w-3 h-3 rounded-full bg-yellow"/>
          <div class="w-3 h-3 rounded-full bg-green animate-pulse"/>
        </div>
        <div class="text-center flex-1 text-sm text-subtext0 font-mono">
          {{ title || "dave.io" }} ::
          <NuxtLink v-if="showFishLink" to="https://github.com/fish-shell/fish-shell" class="link-url"> fish</NuxtLink>
          <span v-if="!showFishLink">{{ subtitle }}</span> ::
          <EmailAddress encoded-email="Fzf3Z1Z/b99fDc/3" /> ::
          {{ dimensions || "13×37" }}
        </div>
      </div>

      <!-- Interface content - scrollable -->
      <div
ref="interfaceContent"
        :class="['terminal-content text-text p-4 text-sm flex-1 overflow-y-auto', useMonospace ? 'font-mono' : '']">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import EmailAddress from "../ui/EmailAddress.vue"
import Hero from "./Hero.vue"

interface Props {
  title?: string
  subtitle?: string
  dimensions?: string
  showFishLink?: boolean
  useMonospace?: boolean
}

withDefaults(defineProps<Props>(), {
  title: "dave.io",
  subtitle: "",
  dimensions: "13×37",
  showFishLink: true,
  useMonospace: true
})
</script>

<style scoped>
.terminal-container {
  max-height: 90vh;
}

.terminal-content {
  max-height: calc(90vh - 3rem);
  /* Subtract header height */
}

@media (max-width: 800px) {
  .terminal-container {
    min-height: auto;
    max-height: none;
    border-radius: 0.75rem;
  }

  .terminal-content {
    padding: 1rem 0.5rem;
    max-height: none;
  }
}
</style>
