package id.geoexplorer.app.core.project

data class ProjectDefinition(
    val id: String,
    val name: String,
    val crsAuthority: String = "EPSG",
    val crsCode: Int = 4326,
    val countryScope: String = "Indonesia"
) {
    fun validationErrors(): List<String> = buildList {
        if (id.isBlank()) add("ID proyek tidak boleh kosong")
        if (name.isBlank()) add("Nama proyek tidak boleh kosong")
        if (crsAuthority.isBlank()) add("Otoritas CRS tidak boleh kosong")
        if (crsCode <= 0) add("Kode CRS harus berupa bilangan positif")
        if (countryScope.isBlank()) add("Cakupan wilayah tidak boleh kosong")
    }

    val isValid: Boolean
        get() = validationErrors().isEmpty()
}
