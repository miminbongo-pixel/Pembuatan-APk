package id.geoexplorer.app.core.project

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ProjectDefinitionTest {
    @Test fun defaultProjectMetadataIsValid() {
        assertTrue(ProjectDefinition(id = "project-1", name = "Survei Pesisir").isValid)
    }

    @Test fun blankNameIsRejected() {
        assertFalse(ProjectDefinition(id = "project-1", name = " ").isValid)
    }

    @Test fun blankIdAuthorityScopeOrNonPositiveCrsIsRejected() {
        assertFalse(ProjectDefinition(id = "", name = "Survei").isValid)
        assertFalse(ProjectDefinition(id = "p-1", name = "Survei", crsAuthority = " ").isValid)
        assertFalse(ProjectDefinition(id = "p-1", name = "Survei", crsCode = 0).isValid)
        assertFalse(ProjectDefinition(id = "p-1", name = "Survei", crsCode = -4326).isValid)
        assertFalse(ProjectDefinition(id = "p-1", name = "Survei", countryScope = "").isValid)
    }

    @Test fun validationErrorsListDescribesInvalidFields() {
        val errors = ProjectDefinition(id = "", name = "", crsCode = 0).validationErrors()
        assertTrue(errors.contains("ID proyek tidak boleh kosong"))
        assertTrue(errors.contains("Nama proyek tidak boleh kosong"))
        assertTrue(errors.contains("Kode CRS harus berupa bilangan positif"))
    }
}
